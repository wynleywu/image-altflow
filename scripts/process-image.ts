#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "fs";
import { basename, resolve } from "path";
import { exiftool } from "exiftool-vendored";
import { mimeTypeFromFileName } from "../lib/filename";
import {
  analyzeLocalImage,
  embedAndWriteImageFromBuffer,
  parseAiFromJson,
} from "../lib/pipeline";

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function printUsage(): void {
  console.log(`Usage:
  npm run process -- <input.jpg> [output.jpg]
  npm run process -- <input.jpg> --analyze-only
  npm run process -- <input.jpg> <output.jpg> --ai <path.ai.json>

Examples:
  npm run process -- ./product.jpg ./product-out.jpg
  npm run process -- ./product.jpg --analyze-only
  npm run process -- ./product.jpg ./product-out.jpg --ai ./product.ai.json`);
}

async function main(): Promise<void> {
  loadEnvLocal();

  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const inputPath = resolve(args[0]);
  const analyzeOnly = args.includes("--analyze-only");
  const aiFlagIndex = args.indexOf("--ai");
  const aiJsonPath = aiFlagIndex >= 0 ? resolve(args[aiFlagIndex + 1]) : null;

  const positional = args.filter((arg, index) => {
    if (arg.startsWith("--")) {
      return false;
    }
    if (aiFlagIndex >= 0 && index === aiFlagIndex + 1) {
      return false;
    }
    return true;
  });

  const outputPath = positional[1] ? resolve(positional[1]) : null;

  if (analyzeOnly) {
    const result = await analyzeLocalImage(inputPath);
    const sidecarPath = `${inputPath}.ai.json`;
    writeFileSync(sidecarPath, JSON.stringify(result.ai, null, 2), "utf8");
    console.log(JSON.stringify(result.ai, null, 2));
    console.log(`\nWrote sidecar: ${sidecarPath}`);
    return;
  }

  if (!outputPath) {
    console.error("Error: output path is required unless --analyze-only is used.");
    printUsage();
    process.exit(1);
  }

  let ai;
  if (aiJsonPath) {
    const raw = JSON.parse(readFileSync(aiJsonPath, "utf8"));
    ai = parseAiFromJson(raw);
  } else {
    const analyzed = await analyzeLocalImage(inputPath);
    ai = analyzed.ai;
    console.log("AI result:");
    console.log(JSON.stringify(ai, null, 2));
  }

  const inputBuffer = readFileSync(inputPath);
  const mimeType = mimeTypeFromFileName(basename(inputPath));

  const { buffer, fileName } = await embedAndWriteImageFromBuffer(
    inputBuffer,
    outputPath,
    mimeType,
    ai,
  );

  console.log(`\nWrote: ${outputPath}`);
  console.log(`Download name: ${fileName}`);
  console.log(`MIME: ${mimeType}`);
  console.log(`Bytes: ${buffer.length}`);

  try {
    const tags = (await exiftool.read(outputPath)) as Record<string, unknown>;
    console.log("\nMetadata summary (English fields):");
    console.log(`  AltTextAccessibility: ${tags.AltTextAccessibility ?? tags.ImageDescription ?? "—"}`);
    console.log(`  Caption-Abstract: ${tags.CaptionAbstract ?? "—"}`);
    const keywords = tags.Keywords;
    console.log(
      `  Keywords: ${Array.isArray(keywords) ? keywords.join(", ") : keywords ?? "—"}`,
    );
    console.log(`  Description: ${tags.Description ?? "—"}`);
  } catch (readError) {
    console.warn("Could not read back metadata:", readError);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await exiftool.end();
  });

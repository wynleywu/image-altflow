import { exiftool } from "exiftool-vendored";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { AiImageResult } from "./types";
import { mimeTypeFromFileName, sanitizeDownloadFileName } from "./filename";
import { injectJpegMetadata, injectPngMetadata } from "./embed-metadata-js";

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("gif")) return ".gif";
  return ".jpg";
}

async function embedWithExiftool(buffer: Buffer, mimeType: string, ai: AiImageResult): Promise<Buffer> {
  const ext = extensionForMime(mimeType);
  const dir = await mkdtemp(join(tmpdir(), "altflow-"));
  const inputPath = join(dir, `input${ext}`);

  try {
    await writeFile(inputPath, buffer);

    const fullDescription = ai.image_description_en || ai.caption_en;
    const tags: Record<string, string | string[]> = {
      "EXIF:ImageDescription": fullDescription,
      "IPTC:Caption-Abstract": fullDescription,
      "XMP-dc:Description": fullDescription,
      "XMP-iptcCore:AltTextAccessibility": ai.alt_text_en,
      "XMP-photoshop:Headline": ai.caption_en,
    };

    if (ai.tags_en.length > 0) {
      tags["IPTC:Keywords"] = ai.tags_en;
      tags["XMP-dc:Subject"] = ai.tags_en;
    }

    await exiftool.write(inputPath, tags, ["-overwrite_original"]);
    return await readFile(inputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function embedWithJsFallback(buffer: Buffer, mimeType: string, ai: AiImageResult): Buffer {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    console.warn("[embed] ExifTool unavailable; using JPEG JS fallback");
    return injectJpegMetadata(buffer, ai);
  }
  if (mimeType.includes("png")) {
    console.warn("[embed] ExifTool unavailable; using PNG JS fallback");
    return injectPngMetadata(buffer, ai);
  }
  throw new Error(
    `embed_unavailable: ExifTool unavailable and no JS fallback for mimeType=${mimeType}`,
  );
}

export async function embedMetadataIntoImage(
  buffer: Buffer,
  mimeType: string,
  ai: AiImageResult,
): Promise<Buffer> {
  try {
    return await embedWithExiftool(buffer, mimeType, ai);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // ExifTool unavailable (no Perl on Linux serverless, or binary not found)
    if (msg.includes("Perl") || msg.includes("ENOENT") || msg.includes("spawn")) {
      return embedWithJsFallback(buffer, mimeType, ai);
    }
    throw err;
  }
}

export function buildDownloadFileName(ai: AiImageResult, mimeType: string): string {
  return sanitizeDownloadFileName(ai.new_file_name, mimeType);
}

export function resolveMimeType(mimeType: string | undefined, fileName: string): string {
  if (mimeType && mimeType.startsWith("image/")) {
    return mimeType;
  }
  return mimeTypeFromFileName(fileName);
}

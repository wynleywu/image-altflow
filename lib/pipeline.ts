import { readFile, writeFile } from "fs/promises";
import { basename } from "path";
import { analyzeImageFromBuffer } from "./ai";
import { normalizeAiResult } from "./gemini";
import { buildDownloadFileName, embedMetadataIntoImage, resolveMimeType } from "./embed-metadata";
import { mimeTypeFromFileName } from "./filename";
import type { AiImageResult, PipelineAnalyzeResult, PipelineEmbedResult } from "./types";

const MAX_AI_TAGS = 25;
const MAX_AI_TAG_CHARS = 100;
const MAX_METADATA_TEXT_BYTES = 12_000;
const AI_STRING_LIMITS: Record<string, number> = {
  image_description_en: 4_000,
  image_description_zh: 4_000,
  image_description: 4_000,
  new_file_name: 120,
  alt_text_en: 1_000,
  alt_text_zh: 1_000,
  alt_text: 1_000,
  caption_en: 2_000,
  caption_zh: 2_000,
  caption: 2_000,
  product_type_en: 500,
  product_type_zh: 500,
  product_type: 500,
  main_color_en: 500,
  main_color_zh: 500,
  main_color: 500,
  scene_en: 1_000,
  scene_zh: 1_000,
  scene: 1_000,
  brand: 200,
  model: 200,
};
const REQUIRED_AI_FIELDS = [
  "image_description_en",
  "new_file_name",
  "alt_text_en",
  "caption_en",
] as const;

export async function analyzeLocalImage(filePath: string): Promise<PipelineAnalyzeResult> {
  const buffer = await readFile(filePath);
  const originalFileName = basename(filePath);
  const mimeType = mimeTypeFromFileName(originalFileName);
  const ai = await analyzeImageFromBuffer(buffer, mimeType);
  return { ai, buffer, mimeType, originalFileName };
}

export async function analyzeImageBuffer(
  buffer: Buffer,
  mimeType: string,
  originalFileName: string,
  opts?: { brand?: string; model?: string },
): Promise<PipelineAnalyzeResult> {
  const resolvedMime = resolveMimeType(mimeType, originalFileName);
  const ai = await analyzeImageFromBuffer(buffer, resolvedMime, opts);
  if (opts?.brand) ai.brand = opts.brand;
  if (opts?.model) ai.model = opts.model;
  return { ai, buffer, mimeType: resolvedMime, originalFileName };
}

export function parseAiFromJson(raw: unknown): AiImageResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid AI JSON: expected an object");
  }

  const record = raw as Record<string, unknown>;
  for (const [field, maxChars] of Object.entries(AI_STRING_LIMITS)) {
    const value = record[field];
    if (value === undefined) continue;
    if (typeof value !== "string") {
      throw new Error(`Invalid AI JSON: ${field} must be a string`);
    }
    if (value.length > maxChars) {
      throw new Error(`Invalid AI JSON: ${field} exceeds ${maxChars} characters`);
    }
  }

  for (const field of ["tags_en", "tags_zh", "tags"] as const) {
    const value = record[field];
    if (value === undefined) continue;
    if (typeof value === "string") {
      if (value.length > MAX_AI_TAGS * (MAX_AI_TAG_CHARS + 1)) {
        throw new Error(`Invalid AI JSON: ${field} is too long`);
      }
      continue;
    }
    if (
      !Array.isArray(value)
      || value.length > MAX_AI_TAGS
      || value.some((tag) => typeof tag !== "string" || tag.length > MAX_AI_TAG_CHARS)
    ) {
      throw new Error(
        `Invalid AI JSON: ${field} must contain at most ${MAX_AI_TAGS} string tags of ${MAX_AI_TAG_CHARS} characters`,
      );
    }
  }

  if (
    record.confidence_note !== undefined
    && record.confidence_note !== "certain"
    && record.confidence_note !== "uncertain"
  ) {
    throw new Error('Invalid AI JSON: confidence_note must be "certain" or "uncertain"');
  }

  const normalized = normalizeAiResult(record as Partial<AiImageResult> & Record<string, unknown>);
  for (const field of ["tags_en", "tags_zh"] as const) {
    if (
      normalized[field].length > MAX_AI_TAGS
      || normalized[field].some((tag) => tag.length > MAX_AI_TAG_CHARS)
    ) {
      throw new Error(
        `Invalid AI JSON: ${field} must contain at most ${MAX_AI_TAGS} tags of ${MAX_AI_TAG_CHARS} characters`,
      );
    }
  }
  const missing = REQUIRED_AI_FIELDS.filter((field) => !normalized[field].trim());
  if (missing.length > 0) {
    throw new Error(`Invalid AI JSON: missing required fields: ${missing.join(", ")}`);
  }

  const metadataText = [
    normalized.image_description_en,
    normalized.alt_text_en,
    normalized.caption_en,
    ...normalized.tags_en,
    normalized.brand ?? "",
    normalized.model ?? "",
  ].join("");
  if (Buffer.byteLength(metadataText, "utf8") > MAX_METADATA_TEXT_BYTES) {
    throw new Error(`Invalid AI JSON: embedded metadata exceeds ${MAX_METADATA_TEXT_BYTES} bytes`);
  }
  return normalized;
}

export async function embedImageBuffer(
  buffer: Buffer,
  mimeType: string,
  ai: AiImageResult,
): Promise<PipelineEmbedResult> {
  const resolvedMime = resolveMimeType(mimeType, ai.new_file_name);
  const processed = await embedMetadataIntoImage(buffer, resolvedMime, ai);
  const fileName = buildDownloadFileName(ai, resolvedMime);
  return { buffer: processed, fileName, mimeType: resolvedMime };
}

export async function embedAndWriteImage(
  inputPath: string,
  outputPath: string,
  ai: AiImageResult,
): Promise<PipelineEmbedResult> {
  const inputBuffer = await readFile(inputPath);
  const mimeType = mimeTypeFromFileName(basename(inputPath));
  const result = await embedImageBuffer(inputBuffer, mimeType, ai);
  await writeFile(outputPath, result.buffer);
  return result;
}

export async function embedAndWriteImageFromBuffer(
  inputBuffer: Buffer,
  outputPath: string,
  mimeType: string,
  ai: AiImageResult,
): Promise<PipelineEmbedResult> {
  const result = await embedImageBuffer(inputBuffer, mimeType, ai);
  await writeFile(outputPath, result.buffer);
  return result;
}

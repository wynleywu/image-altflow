import { readFile, writeFile } from "fs/promises";
import { basename } from "path";
import { analyzeImageFromBuffer, normalizeAiResult } from "./gemini";
import { buildDownloadFileName, embedMetadataIntoImage, resolveMimeType } from "./embed-metadata";
import { mimeTypeFromFileName } from "./filename";
import type { AiImageResult, PipelineAnalyzeResult, PipelineEmbedResult } from "./types";

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
): Promise<PipelineAnalyzeResult> {
  const resolvedMime = resolveMimeType(mimeType, originalFileName);
  const ai = await analyzeImageFromBuffer(buffer, resolvedMime);
  return { ai, buffer, mimeType: resolvedMime, originalFileName };
}

export function parseAiFromJson(raw: unknown): AiImageResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid AI JSON: expected an object");
  }
  return normalizeAiResult(raw as Partial<AiImageResult> & Record<string, unknown>);
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

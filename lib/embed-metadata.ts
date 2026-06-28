import { exiftool } from "exiftool-vendored";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { AiImageResult } from "./types";
import { mimeTypeFromFileName, sanitizeDownloadFileName } from "./filename";
import { injectJpegMetadata } from "./embed-metadata-js";

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

    const tags: Record<string, string | string[]> = {
      "XMP-iptcExt:AltTextAccessibility": ai.alt_text_en,
      "EXIF:ImageDescription": ai.alt_text_en,
      "IPTC:Caption-Abstract": ai.caption_en,
      "XMP-dc:Description": ai.image_description_en || ai.caption_en,
    };

    if (ai.tags_en.length > 0) {
      tags["IPTC:Keywords"] = ai.tags_en;
    }
    if (ai.brand) tags["IPTC:Credit"] = ai.brand;
    if (ai.model) tags["EXIF:Model"] = ai.model;

    await exiftool.write(inputPath, tags, ["-overwrite_original"]);
    return await readFile(inputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
      if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
        return injectJpegMetadata(buffer, ai);
      }
      // Non-JPEG without ExifTool: return original rather than failing
      return buffer;
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

import { exiftool } from "exiftool-vendored";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { AiImageResult } from "./types";
import { mimeTypeFromFileName, sanitizeDownloadFileName } from "./filename";

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("gif")) return ".gif";
  return ".jpg";
}

export async function embedMetadataIntoImage(
  buffer: Buffer,
  mimeType: string,
  ai: AiImageResult,
): Promise<Buffer> {
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

    await exiftool.write(inputPath, tags, ["-overwrite_original"]);
    return await readFile(inputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
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

import { put } from "@vercel/blob";
import { parseFileNameFromUrl } from "./validation";

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "image.jpg";
}

function extensionFromMime(mimeType: string): string {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("gif")) return ".gif";
  if (mimeType.includes("svg")) return ".svg";
  return ".jpg";
}

export async function persistImageFromUrl(sourceUrl: string, traceId: string, fileName?: string): Promise<{
  storedUrl: string;
  originalFileName: string;
  sourceImageUrl: string;
}> {
  const response = await fetch(sourceUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const originalFileName = fileName || parseFileNameFromUrl(sourceUrl);
  const safeName = sanitizeFileName(originalFileName);
  const hasExt = /\.[a-z0-9]+$/i.test(safeName);
  const pathname = `images/${traceId}/${hasExt ? safeName : `${safeName}${extensionFromMime(mimeType)}`}`;
  const buffer = Buffer.from(await response.arrayBuffer());

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
  });

  return {
    storedUrl: blob.url,
    originalFileName,
    sourceImageUrl: sourceUrl,
  };
}

export async function persistImageFromFile(file: File, traceId: string): Promise<{
  storedUrl: string;
  originalFileName: string;
  sourceImageUrl: string;
}> {
  const originalFileName = file.name || "upload.jpg";
  const safeName = sanitizeFileName(originalFileName);
  const pathname = `images/${traceId}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: file.type || "image/jpeg",
    addRandomSuffix: false,
  });

  return {
    storedUrl: blob.url,
    originalFileName,
    sourceImageUrl: "",
  };
}

export async function persistProcessedBuffer(
  buffer: Buffer,
  traceId: string,
  fileName: string,
  mimeType: string,
): Promise<{ storedUrl: string }> {
  const safeName = sanitizeFileName(fileName);
  const pathname = `images/${traceId}/processed/${safeName}`;

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
  });

  return { storedUrl: blob.url };
}

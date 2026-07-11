const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function sanitizeDownloadFileName(fileName: string, mimeType: string): string {
  const fallbackExt = MIME_EXT[mimeType] || ".jpg";
  let safe = fileName
    .trim()
    .replace(/[^\w.\-]+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/-+/g, "-")
    .replace(/^[.\-]+|[.\-]+$/g, "")
    .slice(0, 120);

  if (!safe) {
    safe = `image${fallbackExt}`;
  }

  const hasExt = /\.[a-z0-9]+$/i.test(safe);
  if (!hasExt) {
    safe = `${safe}${fallbackExt}`;
  }

  return safe;
}

export function mimeTypeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

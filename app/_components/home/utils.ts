import type { AiImageResult } from "@/lib/types";
import { addLocalHistoryRecord } from "@/lib/client/history-store";

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function filesFromClipboard(event: ClipboardEvent): File[] {
  const data = event.clipboardData;
  if (!data) return [];

  const fromItems: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (!file) continue;
    const hasName = Boolean(file.name && file.name !== "image.png" && file.name !== "blob");
    if (hasName) {
      fromItems.push(file);
      continue;
    }
    const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
    fromItems.push(new File([file], `pasted-image.${ext}`, { type: file.type }));
  }
  if (fromItems.length > 0) return fromItems;

  return Array.from(data.files ?? []).filter((file) => file.type.startsWith("image/"));
}

export function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export async function compressImage(file: File, maxBytes = 5 * 1024 * 1024): Promise<File> {
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  const MAX_SIDE = 2048;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let quality = 0.85;
  let blob!: Blob;
  do {
    blob = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), "image/jpeg", quality)
    );
    quality -= 0.1;
  } while (blob.size > maxBytes && quality >= 0.4);

  canvas.width = 0;
  canvas.height = 0;

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadBase64(base64: string, fileName: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  downloadBlob(blob, fileName);
}

export async function makeThumbnailDataUrl(file: File, maxSize = 200, quality = 0.6): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function saveLocalHistory(
  ai: AiImageResult,
  originalFileName: string,
  thumbnailDataUrl: string,
) {
  try {
    await addLocalHistoryRecord({
      recordId: crypto.randomUUID(),
      traceId: crypto.randomUUID(),
      imageUrl: "",
      sourceImageUrl: "",
      thumbnailDataUrl,
      originalFileName,
      source: "web",
      imageDescription: ai.image_description_en,
      newFileName: ai.new_file_name,
      altText: ai.alt_text_en,
      caption: ai.caption_en,
      tags: ai.tags_en,
      productType: ai.product_type_en,
      mainColor: ai.main_color_en,
      scene: ai.scene_en,
      confidenceNote: ai.confidence_note,
      flowStatus: "success",
      reviewStatus: "",
      errorType: "",
      errorMessage: "",
      manualNote: JSON.stringify(ai),
      createdAt: Date.now(),
    });
  } catch {
    // local history is best-effort; ignore storage failures (e.g. private browsing)
  }
}

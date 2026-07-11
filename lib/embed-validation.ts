export const MAX_EMBED_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_EMBED_AI_JSON_CHARS = 32 * 1024;
export const MAX_EMBED_BASE64_CHARS = Math.ceil(MAX_EMBED_IMAGE_BYTES * 4 / 3) + 8;
export const MAX_EMBED_JSON_BODY_BYTES = MAX_EMBED_BASE64_CHARS + MAX_EMBED_AI_JSON_CHARS + 4096;
export const MAX_EMBED_MULTIPART_BODY_BYTES = MAX_EMBED_IMAGE_BYTES + MAX_EMBED_AI_JSON_CHARS + 64 * 1024;

type EmbedValidationErrorType =
  | "invalid_request"
  | "invalid_ai_json"
  | "invalid_base64"
  | "invalid_image"
  | "mime_mismatch"
  | "request_too_large";

export class EmbedValidationError extends Error {
  constructor(
    public readonly errorType: EmbedValidationErrorType,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "EmbedValidationError";
  }
}

export function decodeImageBase64(value: string): Buffer {
  const normalized = value.replace(/\s+/g, "");
  const remainder = normalized.length % 4;
  if (!normalized || remainder === 1) {
    throw new EmbedValidationError("invalid_base64", "imageBase64 is not valid base64");
  }

  const padded = normalized.padEnd(normalized.length + ((4 - remainder) % 4), "=");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(padded)) {
    throw new EmbedValidationError("invalid_base64", "imageBase64 is not valid base64");
  }

  const buffer = Buffer.from(padded, "base64");
  const canonical = buffer.toString("base64").replace(/=+$/, "");
  if (!buffer.length || canonical !== normalized.replace(/=+$/, "")) {
    throw new EmbedValidationError("invalid_base64", "imageBase64 is not valid base64");
  }
  return buffer;
}

export function detectImageMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (buffer.length >= 6) {
    const signature = buffer.subarray(0, 6).toString("ascii");
    if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function normalizeMimeType(value: string): string {
  const mimeType = value.split(";", 1)[0].trim().toLowerCase();
  return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
}

export function validateImageBuffer(buffer: Buffer, declaredMimeType: string): string {
  const detectedMimeType = detectImageMimeType(buffer);
  if (!detectedMimeType) {
    throw new EmbedValidationError(
      "invalid_image",
      "Unsupported or invalid image data; use JPEG, PNG, WebP, or GIF",
    );
  }

  const normalizedDeclared = normalizeMimeType(declaredMimeType);
  if (
    normalizedDeclared
    && normalizedDeclared !== "application/octet-stream"
    && normalizedDeclared !== detectedMimeType
  ) {
    throw new EmbedValidationError(
      "mime_mismatch",
      `Declared mimeType ${normalizedDeclared} does not match ${detectedMimeType}`,
    );
  }
  return detectedMimeType;
}

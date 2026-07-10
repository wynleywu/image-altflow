import { NextResponse } from "next/server";
import { embedImageBuffer, parseAiFromJson } from "@/lib/pipeline";
import { canPersistAll } from "@/lib/persist";
import { createImageRecord } from "@/lib/records";
import { persistProcessedBuffer } from "@/lib/storage";
import { createTraceId } from "@/lib/validation";
import {
  decodeImageBase64,
  EmbedValidationError,
  MAX_EMBED_AI_JSON_CHARS,
  MAX_EMBED_BASE64_CHARS,
  MAX_EMBED_IMAGE_BYTES,
  MAX_EMBED_JSON_BODY_BYTES,
  MAX_EMBED_MULTIPART_BODY_BYTES,
  validateImageBuffer,
} from "@/lib/embed-validation";
import type { AiImageResult, EmbedRequest } from "@/lib/types";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

function tooLargeResponse() {
  return NextResponse.json(
    { ok: false, error: "图片超过 5 MB，请压缩后重试", error_type: "file_too_large" },
    { status: 413 },
  );
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, "embed");
    if (limited) return limited;

    const contentType = request.headers.get("content-type") || "";
    const contentLength = Number(request.headers.get("content-length"));
    const maxBodyBytes = contentType.includes("multipart/form-data")
      ? MAX_EMBED_MULTIPART_BODY_BYTES
      : MAX_EMBED_JSON_BODY_BYTES;
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
      throw new EmbedValidationError(
        "request_too_large",
        "Embed request body is too large",
        413,
      );
    }

    let inputBuffer: Buffer;
    let sourceMimeType: string;
    let ai: AiImageResult;
    let traceId: string | undefined;
    let originalFileName: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      // Web client path: re-uploads the original File as binary (no base64 round-trip).
      const form = await request.formData();
      const file = form.get("image");
      const aiRaw = String(form.get("ai") || "");

      if (!(file instanceof File) || file.size === 0 || !aiRaw) {
        return NextResponse.json(
          { ok: false, error: "image file and ai are required", error_type: "invalid_request" },
          { status: 400 },
        );
      }

      if (file.size > MAX_EMBED_IMAGE_BYTES) {
        return tooLargeResponse();
      }

      if (aiRaw.length > MAX_EMBED_AI_JSON_CHARS) {
        throw new EmbedValidationError("invalid_ai_json", "AI JSON is too large");
      }

      inputBuffer = Buffer.from(await file.arrayBuffer());
      sourceMimeType = file.type || String(form.get("mimeType") || "");
      let parsedAi: unknown;
      try {
        parsedAi = JSON.parse(aiRaw);
      } catch {
        throw new EmbedValidationError("invalid_ai_json", "AI JSON is not valid JSON");
      }
      ai = parseAiFromJson(parsedAi);
      traceId = String(form.get("traceId") || "").trim() || undefined;
      originalFileName = file.name || String(form.get("originalFileName") || "") || undefined;
    } else {
      // Documented JSON API path: imageBase64 + mimeType + ai.
      let rawBody: unknown;
      try {
        rawBody = await request.json();
      } catch {
        throw new EmbedValidationError("invalid_request", "Request body is not valid JSON");
      }
      if (!rawBody || typeof rawBody !== "object") {
        throw new EmbedValidationError("invalid_request", "Request body must be a JSON object");
      }
      const body = rawBody as Partial<EmbedRequest>;

      if (
        typeof body.imageBase64 !== "string"
        || !body.imageBase64
        || typeof body.mimeType !== "string"
        || !body.mimeType.trim()
        || !body.ai
        || typeof body.ai !== "object"
      ) {
        return NextResponse.json(
          { ok: false, error: "imageBase64, mimeType, and ai are required", error_type: "invalid_request" },
          { status: 400 },
        );
      }

      if (body.imageBase64.length > MAX_EMBED_BASE64_CHARS) {
        return tooLargeResponse();
      }

      const aiJson = JSON.stringify(body.ai);
      if (!aiJson || aiJson.length > MAX_EMBED_AI_JSON_CHARS) {
        throw new EmbedValidationError("invalid_ai_json", "AI JSON is too large");
      }

      inputBuffer = decodeImageBase64(body.imageBase64);
      if (inputBuffer.length > MAX_EMBED_IMAGE_BYTES) {
        return tooLargeResponse();
      }
      sourceMimeType = body.mimeType;
      ai = parseAiFromJson(body.ai);
      traceId = body.traceId;
      originalFileName = body.originalFileName;
    }

    sourceMimeType = validateImageBuffer(inputBuffer, sourceMimeType);

    const { buffer, fileName, mimeType } = await embedImageBuffer(inputBuffer, sourceMimeType, ai);

    const download = {
      fileName,
      mimeType,
      base64: buffer.toString("base64"),
    };

    let record;
    if (canPersistAll()) {
      try {
        const resolvedTraceId = traceId || createTraceId();
        const { storedUrl } = await persistProcessedBuffer(buffer, resolvedTraceId, fileName, mimeType);
        record = await createImageRecord({
          traceId: resolvedTraceId,
          imageUrl: storedUrl,
          originalFileName: originalFileName || fileName,
          flowStatus: "success",
          ai,
        });
      } catch (persistError) {
        console.warn(
          "[embed] optional persistence failed:",
          persistError instanceof Error ? persistError.message : persistError,
        );
      }
    }

    return NextResponse.json({ ok: true, download, record });
  } catch (error) {
    if (error instanceof EmbedValidationError) {
      return NextResponse.json(
        { ok: false, error: error.message, error_type: error.errorType },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Embed failed";
    const errorType = message.includes("Invalid AI JSON")
      ? "invalid_ai_json"
      : message.startsWith("embed_unavailable")
        ? "embed_unavailable"
        : "embed_failed";
    const status = errorType === "invalid_ai_json" ? 400 : errorType === "embed_unavailable" ? 503 : 502;
    return NextResponse.json({ ok: false, error: message, error_type: errorType }, { status });
  }
}

import { NextResponse } from "next/server";
import { embedImageBuffer, parseAiFromJson } from "@/lib/pipeline";
import { canPersistAll } from "@/lib/persist";
import { createImageRecord } from "@/lib/records";
import { persistProcessedBuffer } from "@/lib/storage";
import { createTraceId } from "@/lib/validation";
import type { AiImageResult, EmbedRequest } from "@/lib/types";

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 8;

function tooLargeResponse() {
  return NextResponse.json(
    { ok: false, error: "图片超过 5 MB，请压缩后重试", error_type: "file_too_large" },
    { status: 413 },
  );
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
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

      if (file.size > MAX_IMAGE_BYTES) {
        return tooLargeResponse();
      }

      inputBuffer = Buffer.from(await file.arrayBuffer());
      sourceMimeType = String(form.get("mimeType") || "") || file.type || "image/jpeg";
      ai = parseAiFromJson(JSON.parse(aiRaw));
      traceId = String(form.get("traceId") || "").trim() || undefined;
      originalFileName = file.name || String(form.get("originalFileName") || "") || undefined;
    } else {
      // Documented JSON API path: imageBase64 + mimeType + ai.
      const body = (await request.json()) as EmbedRequest;

      if (!body.imageBase64 || !body.mimeType || !body.ai) {
        return NextResponse.json(
          { ok: false, error: "imageBase64, mimeType, and ai are required", error_type: "invalid_request" },
          { status: 400 },
        );
      }

      if (body.imageBase64.length > MAX_BASE64_CHARS) {
        return tooLargeResponse();
      }

      inputBuffer = Buffer.from(body.imageBase64, "base64");
      if (inputBuffer.length > MAX_IMAGE_BYTES) {
        return tooLargeResponse();
      }
      sourceMimeType = body.mimeType;
      ai = parseAiFromJson(body.ai);
      traceId = body.traceId;
      originalFileName = body.originalFileName;
    }

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

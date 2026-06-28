import { NextResponse } from "next/server";
import { embedImageBuffer, parseAiFromJson } from "@/lib/pipeline";
import { canPersistAll } from "@/lib/persist";
import { createImageRecord } from "@/lib/records";
import { persistProcessedBuffer } from "@/lib/storage";
import { createTraceId } from "@/lib/validation";
import type { AiImageResult, EmbedRequest } from "@/lib/types";

export const maxDuration = 60;

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

      inputBuffer = Buffer.from(body.imageBase64, "base64");
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
      } catch {
        // optional persistence
      }
    }

    return NextResponse.json({ ok: true, download, record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embed failed";
    const errorType = message.includes("Invalid AI JSON") ? "invalid_ai_json" : "embed_failed";
    return NextResponse.json({ ok: false, error: message, error_type: errorType }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { analyzeImageBuffer } from "@/lib/pipeline";
import { canPersistRecords } from "@/lib/persist";
import { createImageRecord } from "@/lib/records";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createTraceId } from "@/lib/validation";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(request, "analyze");
    if (limited) return limited;

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          ok: false,
          error: "multipart image upload is required (image_url is not supported)",
          error_type: "invalid_request",
        },
        { status: 400 },
      );
    }

    const form = await request.formData();
    const file = form.get("image");
    const traceId = String(form.get("trace_id") || "").trim() || createTraceId();

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { ok: false, error: "image file is required", error_type: "missing_image" },
        { status: 400 },
      );
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: "图片超过 5 MB，请压缩后重试", error_type: "file_too_large" },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";
    const originalFileName = file.name || "upload.jpg";
    const brand = String(form.get("brand") || "").trim() || undefined;
    const model = String(form.get("model") || "").trim() || undefined;
    const { ai, mimeType: resolvedMime } = await analyzeImageBuffer(
      buffer,
      mimeType,
      originalFileName,
      { brand, model },
    );

    let record;
    if (canPersistRecords()) {
      try {
        record = await createImageRecord({
          traceId,
          imageUrl: "",
          originalFileName,
          flowStatus: "success",
          ai,
        });
      } catch (persistError) {
        console.warn(
          "[analyze] optional persistence failed:",
          persistError instanceof Error ? persistError.message : persistError,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      ai,
      originalImageBase64: buffer.toString("base64"),
      mimeType: resolvedMime,
      originalFileName,
      record,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const errorType = message.startsWith("ai_parse_error")
      ? "ai_parse_error"
      : message.startsWith("gemini_timeout")
        ? "gemini_timeout"
        : "analyze_failed";
    return NextResponse.json({ ok: false, error: message, error_type: errorType }, { status: 502 });
  }
}

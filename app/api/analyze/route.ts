import { NextResponse } from "next/server";
import { analyzeImageFromBuffer } from "@/lib/ai";
import { fetchImageAsBase64 } from "@/lib/gemini";
import { analyzeImageBuffer } from "@/lib/pipeline";
import { canPersistRecords } from "@/lib/persist";
import { createImageRecord } from "@/lib/records";
import { createTraceId } from "@/lib/validation";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let traceId = createTraceId();

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("image");
      traceId = String(form.get("trace_id") || "").trim() || traceId;

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
      const { ai } = await analyzeImageBuffer(buffer, mimeType, originalFileName, { brand, model });

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
        } catch {
          // optional persistence must not block analyze
        }
      }

      return NextResponse.json({
        ok: true,
        ai,
        originalImageBase64: buffer.toString("base64"),
        mimeType,
        originalFileName,
        record,
      });
    }

    const body = await request.json();
    const imageUrl = String(body.image_url || "").trim();
    traceId = body.trace_id || traceId;

    if (!imageUrl) {
      return NextResponse.json(
        { ok: false, error: "image file or image_url is required", error_type: "missing_image" },
        { status: 400 },
      );
    }

    const { data, mimeType } = await fetchImageAsBase64(imageUrl);
    const buffer = Buffer.from(data, "base64");
    const ai = await analyzeImageFromBuffer(buffer, mimeType);

    let record;
    if (canPersistRecords()) {
      try {
        record = await createImageRecord({
          traceId,
          imageUrl: "",
          sourceImageUrl: imageUrl,
          originalFileName: body.original_file_name || "from-url.jpg",
          flowStatus: "success",
          ai,
        });
      } catch {
        // optional
      }
    }

    return NextResponse.json({
      ok: true,
      ai,
      originalImageBase64: data,
      mimeType,
      originalFileName: body.original_file_name || "from-url.jpg",
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

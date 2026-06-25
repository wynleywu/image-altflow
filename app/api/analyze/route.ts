import { NextResponse } from "next/server";
import { analyzeImage } from "@/lib/gemini";
import { createImageRecord } from "@/lib/feishu";
import { validateAnalyzeInput } from "@/lib/validation";
import type { AnalyzeRequest } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AnalyzeRequest>;
    const validated = validateAnalyzeInput(body);

    if (!validated.ok) {
      const record = await createImageRecord({
        traceId: body.trace_id || `img-${Date.now()}`,
        imageUrl: String(body.image_url ?? ""),
        originalFileName: body.original_file_name || "unknown.jpg",
        flowStatus: "failed",
        errorType: validated.error_type,
        errorMessage: validated.error,
      });
      return NextResponse.json(
        { ok: false, error: validated.error, error_type: validated.error_type, record },
        { status: 400 },
      );
    }

    const { image_url, original_file_name, trace_id } = validated.data;

    try {
      const ai = await analyzeImage(image_url);
      const record = await createImageRecord({
        traceId: trace_id!,
        imageUrl: image_url,
        originalFileName: original_file_name!,
        ai,
        flowStatus: "success",
        reviewStatus: "待审核",
      });
      return NextResponse.json({ ok: true, record });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gemini analysis failed";
      const errorType = message.startsWith("ai_parse_error") ? "ai_parse_error" : "image_fetch_failed";
      const record = await createImageRecord({
        traceId: trace_id!,
        imageUrl: image_url,
        originalFileName: original_file_name!,
        flowStatus: "failed",
        errorType,
        errorMessage: message,
      });
      return NextResponse.json(
        { ok: false, error: message, error_type: errorType, record },
        { status: 502 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

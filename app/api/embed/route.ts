import { NextResponse } from "next/server";
import { embedImageBuffer, parseAiFromJson } from "@/lib/pipeline";
import { canPersistAll } from "@/lib/persist";
import { createImageRecord } from "@/lib/records";
import { persistProcessedBuffer } from "@/lib/storage";
import { createTraceId } from "@/lib/validation";
import type { EmbedRequest } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EmbedRequest;

    if (!body.imageBase64 || !body.mimeType || !body.ai) {
      return NextResponse.json(
        { ok: false, error: "imageBase64, mimeType, and ai are required", error_type: "invalid_request" },
        { status: 400 },
      );
    }

    const ai = parseAiFromJson(body.ai);
    const inputBuffer = Buffer.from(body.imageBase64, "base64");
    const { buffer, fileName, mimeType } = await embedImageBuffer(inputBuffer, body.mimeType, ai);

    const download = {
      fileName,
      mimeType,
      base64: buffer.toString("base64"),
    };

    let record;
    if (canPersistAll()) {
      try {
        const traceId = body.traceId || createTraceId();
        const { storedUrl } = await persistProcessedBuffer(buffer, traceId, fileName, mimeType);
        record = await createImageRecord({
          traceId,
          imageUrl: storedUrl,
          originalFileName: body.originalFileName || fileName,
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

import { NextResponse } from "next/server";
import { requireRecordsApiSecret } from "@/lib/api-auth";
import { updateImageRecord } from "@/lib/records";
import type { ReviewStatus } from "@/lib/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  const denied = requireRecordsApiSecret(request);
  if (denied) return denied;

  try {
    const { recordId } = await context.params;
    const body = await request.json();
    const record = await updateImageRecord(recordId, {
      newFileName: body.new_file_name,
      altText: body.alt_text,
      caption: body.caption,
      reviewStatus: body.review_status as ReviewStatus | undefined,
      manualNote: body.manual_note,
    });
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update record";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

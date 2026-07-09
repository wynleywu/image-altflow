import { NextResponse } from "next/server";
import { requireRecordsApiSecret } from "@/lib/api-auth";
import { listImageRecords } from "@/lib/records";

export async function GET(request: Request) {
  const denied = requireRecordsApiSecret(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const reviewStatus = searchParams.get("review_status") || undefined;
    const records = await listImageRecords(reviewStatus);
    return NextResponse.json({ ok: true, records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list records";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

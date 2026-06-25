import { NextResponse } from "next/server";
import { listImageRecords } from "@/lib/feishu";

export async function GET(request: Request) {
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

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Protect optional records HTTP API.
 * Unconfigured secret → 503 (refuse "DB without lock").
 */
export function requireRecordsApiSecret(request: Request): NextResponse | null {
  const expected = process.env.RECORDS_API_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "records api disabled", error_type: "records_api_disabled" },
      { status: 503 },
    );
  }

  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", error_type: "unauthorized" },
      { status: 401 },
    );
  }

  return null;
}

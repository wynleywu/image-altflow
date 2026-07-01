import { NextResponse } from "next/server";
import { parseAsinFromInput, isValidAsin } from "@/lib/amazon/asin";
import { auditListing } from "@/lib/amazon/audit-listing";
import {
  canFetchAmazonListing,
  fetchAmazonListing,
  fetchProviderLabel,
  normalizeManualSnapshot,
} from "@/lib/amazon/fetch-listing";
import type { AmazonListingSnapshot, AmazonMarketplace } from "@/lib/amazon/types";

export const maxDuration = 60;

function parseMarketplace(value: unknown): AmazonMarketplace {
  const m = String(value ?? "US").toUpperCase();
  if (m === "UK" || m === "DE" || m === "CA" || m === "AU") return m;
  return "US";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const marketplace = parseMarketplace(body.marketplace);

    if (body.manual && typeof body.manual === "object" && body.manual.title) {
      const snapshot = normalizeManualSnapshot(body.manual as Partial<AmazonListingSnapshot> & { title: string }, marketplace);
      const audit = await auditListing(snapshot);
      return NextResponse.json({ ok: true, snapshot, audit, source: "manual" });
    }

    const asinInput = String(body.asin ?? body.url ?? "").trim();
    const asin = parseAsinFromInput(asinInput);
    if (!asin || !isValidAsin(asin)) {
      return NextResponse.json(
        { ok: false, error: "请输入有效的 ASIN 或 Amazon 商品链接", error_type: "invalid_asin" },
        { status: 400 },
      );
    }

    if (!canFetchAmazonListing()) {
      return NextResponse.json(
        {
          ok: false,
          error: "未配置 GEMINI_API_KEY、MODELSCOPE_API_KEY 或 RAINFOREST_API_KEY，请使用手动粘贴 Listing 进行审查",
          error_type: "fetch_not_configured",
          asin,
        },
        { status: 503 },
      );
    }

    const snapshot = await fetchAmazonListing(asin, marketplace);
    const audit = await auditListing(snapshot);
    const source = fetchProviderLabel();
    return NextResponse.json({ ok: true, snapshot, audit, source });
  } catch (err) {
    const message = err instanceof Error ? err.message : "audit failed";
    const errorType = message.startsWith("fetch_") ? message.split(":")[0] : "audit_error";
    return NextResponse.json({ ok: false, error: message, error_type: errorType }, { status: 500 });
  }
}

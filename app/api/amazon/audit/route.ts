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

const USER_ERROR_MESSAGES: Record<string, string> = {
  invalid_asin: "Please enter a valid ASIN or Amazon product URL.",
  fetch_not_configured: "Amazon audit is not configured. Add GEMINI_API_KEY, MODELSCOPE_API_KEY, or RAINFOREST_API_KEY, or use manual listing paste.",
  fetch_blocked: "Amazon blocked automated access for this listing. Try manual listing paste.",
  fetch_failed: "We could not fetch listing data for this ASIN. Check the marketplace or switch to manual listing paste.",
  fetch_proxy_failed: "The fallback reader proxy could not load the listing page.",
  audit_chain_failed: "The listing audit pipeline failed. Check the detailed cause and try manual listing paste.",
  ai_parse_error: "The AI response was not valid JSON. Retry or switch providers.",
  gemini_error: "Gemini request failed. Check GEMINI_API_KEY, model access, and quota.",
  modelscope_error: "ModelScope request failed. Check MODELSCOPE_API_KEY, model access, and quota.",
  audit_error: "Amazon audit failed.",
};

function splitError(message: string): { errorType: string; details: string } {
  const [maybeType, ...rest] = message.split(":");
  const errorType = rest.length > 0 ? maybeType.trim() : "audit_error";
  const details = rest.length > 0 ? rest.join(":").trim() : message.trim();
  return { errorType, details };
}

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
        { ok: false, error: USER_ERROR_MESSAGES.invalid_asin, error_type: "invalid_asin" },
        { status: 400 },
      );
    }

    if (!canFetchAmazonListing()) {
      return NextResponse.json(
        {
          ok: false,
          error: USER_ERROR_MESSAGES.fetch_not_configured,
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
    const { errorType, details } = splitError(message);
    const status =
      errorType === "invalid_asin" ? 400
        : errorType === "fetch_not_configured" ? 503
        : 500;
    const publicMessage = USER_ERROR_MESSAGES[errorType] ?? USER_ERROR_MESSAGES.audit_error;
    console.error("[amazon/audit]", { errorType, details });
    return NextResponse.json({ ok: false, error: publicMessage, error_type: errorType }, { status });
  }
}

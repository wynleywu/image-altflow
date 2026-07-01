import { stripMarkdownFence } from "@/lib/gemini";
import type { AiImageResult } from "@/lib/types";
import { buildListingAuditPrompt } from "./listing-audit-prompt";
import type { AmazonListingSnapshot, ListingAuditIssue, ListingAuditResult } from "./types";
import { callTextLlm } from "./text-llm";
function parseIssues(raw: unknown): ListingAuditIssue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const severity = o.severity === "high" || o.severity === "low" ? o.severity : "medium";
      const area = typeof o.area === "string" ? o.area : "title";
      const message = String(o.message ?? "");
      if (!message) return null;
      return { severity, area, message } as ListingAuditIssue;
    })
    .filter((x): x is ListingAuditIssue => x !== null);
}

function normalizeAuditResult(raw: Record<string, unknown>, snapshot: AmazonListingSnapshot): ListingAuditResult {
  const titleBlock = (raw.title ?? {}) as Record<string, unknown>;
  const highlightsBlock = (raw.itemHighlights ?? {}) as Record<string, unknown>;
  const bulletsBlock = (raw.bullets ?? {}) as Record<string, unknown>;
  const searchBlock = (raw.searchTerms ?? {}) as Record<string, unknown>;
  const attrsBlock = (raw.attributes ?? {}) as Record<string, unknown>;

  const suggestedTitle = String(titleBlock.suggested ?? snapshot.title).slice(0, 75);
  const suggestedHighlights = String(highlightsBlock.suggested ?? "").slice(0, 125);
  const suggestedBullets = Array.isArray(bulletsBlock.suggested)
    ? bulletsBlock.suggested.map(String).slice(0, 5)
    : snapshot.bullets;

  const suggestedAttrs =
    attrsBlock.suggested && typeof attrsBlock.suggested === "object" && !Array.isArray(attrsBlock.suggested)
      ? Object.fromEntries(
          Object.entries(attrsBlock.suggested as Record<string, unknown>)
            .map(([k, v]) => [k, String(v)])
            .filter(([, v]) => v),
        )
      : {};

  return {
    overallScore: Math.min(100, Math.max(0, Number(raw.overallScore) || 0)),
    summary: String(raw.summary ?? ""),
    title: {
      current: snapshot.title,
      charCount: snapshot.title.length,
      issues: parseIssues(titleBlock.issues),
      suggested: suggestedTitle,
    },
    itemHighlights: {
      suggested: suggestedHighlights,
      charCount: suggestedHighlights.length,
      rationale: String(highlightsBlock.rationale ?? ""),
    },
    bullets: {
      current: snapshot.bullets,
      suggested: suggestedBullets,
      issues: parseIssues(bulletsBlock.issues),
    },
    searchTerms: {
      suggested: String(searchBlock.suggested ?? ""),
      issues: parseIssues(searchBlock.issues),
    },
    attributes: {
      missing: Array.isArray(attrsBlock.missing) ? attrsBlock.missing.map(String) : [],
      suggested: suggestedAttrs,
    },
    aPlusOutline: Array.isArray(raw.aPlusOutline) ? raw.aPlusOutline.map(String) : [],
    priorities: Array.isArray(raw.priorities)
      ? raw.priorities
          .map((p, i) => {
            if (!p || typeof p !== "object") return null;
            const o = p as Record<string, unknown>;
            return {
              rank: Number(o.rank) || i + 1,
              item: String(o.item ?? ""),
              reason: String(o.reason ?? ""),
            };
          })
          .filter((x): x is { rank: number; item: string; reason: string } => Boolean(x?.item))
      : [],
  };
}

export async function auditListing(
  snapshot: AmazonListingSnapshot,
  imageContext?: AiImageResult,
): Promise<ListingAuditResult> {
  let prompt = buildListingAuditPrompt(snapshot);
  if (imageContext) {
    prompt += `\n\n## Optional image analysis context (verify listing claims against visible product)\n${JSON.stringify(
      {
        product_type_en: imageContext.product_type_en,
        main_color_en: imageContext.main_color_en,
        scene_en: imageContext.scene_en,
        alt_text_en: imageContext.alt_text_en,
        brand: imageContext.brand,
        model: imageContext.model,
      },
      null,
      2,
    )}`;
  }

  const text = await callTextLlm(prompt);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripMarkdownFence(text));
  } catch {
    throw new Error("ai_parse_error: audit returned invalid JSON");
  }

  return normalizeAuditResult(parsed, snapshot);
}

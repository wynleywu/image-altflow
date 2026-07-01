import type {
  AmazonListingSnapshot,
  ListingAuditArea,
  ListingAuditBasisType,
  ListingAuditImpact,
  ListingAuditIssue,
  ListingAuditResult,
} from "./types";

const AREAS: ListingAuditArea[] = ["title", "highlights", "bullets", "searchTerms", "attributes", "category", "aPlus", "conversion"];
const IMPACTS: ListingAuditImpact[] = ["compliance", "discoverability", "conversion", "completeness", "readability"];
const BASES: ListingAuditBasisType[] = ["confirmed_rule", "listing_evidence", "category_guidance", "heuristic"];

function clampScore(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Math.round(Math.min(100, Math.max(0, Number.isFinite(parsed) ? parsed : fallback)));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "issue";
}

function parseIssues(raw: unknown, fallbackArea: ListingAuditArea): ListingAuditIssue[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    const severity = o.severity === "high" || o.severity === "low" ? o.severity : "medium";
    const area = AREAS.includes(o.area as ListingAuditArea) ? o.area as ListingAuditArea : fallbackArea;
    const message = String(o.message ?? "");
    if (!message) return null;
    const impact = IMPACTS.includes(o.impact as ListingAuditImpact)
      ? o.impact as ListingAuditImpact
      : area === "title" || area === "searchTerms" ? "discoverability" : "conversion";
    const basisType = BASES.includes(o.basisType as ListingAuditBasisType)
      ? o.basisType as ListingAuditBasisType
      : "heuristic";
    const rawConfidence = Number(o.confidence);
    return {
      id: String(o.id ?? `${area}-${index + 1}-${slug(message)}`),
      severity,
      area,
      message,
      impact,
      reason: String(o.reason ?? message),
      evidence: Array.isArray(o.evidence) ? o.evidence.map(String).filter(Boolean).slice(0, 5) : [],
      basisType,
      confidence: Math.min(1, Math.max(0, Number.isFinite(rawConfidence) ? rawConfidence : 0.6)),
    } as ListingAuditIssue;
  }).filter((x): x is ListingAuditIssue => x !== null);
}

export function normalizeAuditResult(raw: Record<string, unknown>, snapshot: AmazonListingSnapshot): ListingAuditResult {
  const titleBlock = (raw.title ?? {}) as Record<string, unknown>;
  const highlightsBlock = (raw.itemHighlights ?? {}) as Record<string, unknown>;
  const bulletsBlock = (raw.bullets ?? {}) as Record<string, unknown>;
  const searchBlock = (raw.searchTerms ?? {}) as Record<string, unknown>;
  const attrsBlock = (raw.attributes ?? {}) as Record<string, unknown>;
  const scoreBlock = (raw.scoreBreakdown ?? {}) as Record<string, unknown>;
  const overallScore = clampScore(raw.overallScore);
  const suggestedTitle = String(titleBlock.suggested ?? snapshot.title).slice(0, 75);
  const suggestedHighlights = String(highlightsBlock.suggested ?? "").slice(0, 125);
  const suggestedBullets = Array.isArray(bulletsBlock.suggested)
    ? bulletsBlock.suggested.map(String).slice(0, 5)
    : snapshot.bullets;
  const suggestedAttrs = attrsBlock.suggested && typeof attrsBlock.suggested === "object" && !Array.isArray(attrsBlock.suggested)
    ? Object.fromEntries(Object.entries(attrsBlock.suggested as Record<string, unknown>).map(([k, v]) => [k, String(v)]).filter(([, v]) => v))
    : {};

  return {
    schemaVersion: 2,
    overallScore,
    scoreBreakdown: {
      compliance: clampScore(scoreBlock.compliance, overallScore),
      discoverability: clampScore(scoreBlock.discoverability, overallScore),
      conversion: clampScore(scoreBlock.conversion, overallScore),
      completeness: clampScore(scoreBlock.completeness, overallScore),
      readability: clampScore(scoreBlock.readability, overallScore),
    },
    summary: String(raw.summary ?? ""),
    title: { current: snapshot.title, charCount: snapshot.title.length, issues: parseIssues(titleBlock.issues, "title"), suggested: suggestedTitle },
    itemHighlights: { suggested: suggestedHighlights, charCount: suggestedHighlights.length, rationale: String(highlightsBlock.rationale ?? "") },
    bullets: { current: snapshot.bullets, suggested: suggestedBullets, issues: parseIssues(bulletsBlock.issues, "bullets") },
    searchTerms: { suggested: String(searchBlock.suggested ?? ""), issues: parseIssues(searchBlock.issues, "searchTerms") },
    attributes: {
      missing: Array.isArray(attrsBlock.missing) ? attrsBlock.missing.map(String) : [],
      suggested: suggestedAttrs,
    },
    aPlusOutline: Array.isArray(raw.aPlusOutline) ? raw.aPlusOutline.map(String) : [],
    priorities: Array.isArray(raw.priorities) ? raw.priorities.map((p, i) => {
      if (!p || typeof p !== "object") return null;
      const o = p as Record<string, unknown>;
      const impact: "high" | "medium" | "low" = o.impact === "high" || o.impact === "low" ? o.impact : "medium";
      const area: ListingAuditArea = AREAS.includes(o.area as ListingAuditArea) ? o.area as ListingAuditArea : "conversion";
      return {
        rank: Number(o.rank) || i + 1,
        item: String(o.item ?? ""),
        reason: String(o.reason ?? ""),
        issueIds: Array.isArray(o.issueIds) ? o.issueIds.map(String) : [],
        impact,
        area,
      };
    }).filter((x): x is NonNullable<typeof x> => Boolean(x?.item)) : [],
  };
}

export function normalizeStoredAuditResult(raw: unknown, snapshot: AmazonListingSnapshot): ListingAuditResult {
  return normalizeAuditResult(raw && typeof raw === "object" ? raw as Record<string, unknown> : {}, snapshot);
}

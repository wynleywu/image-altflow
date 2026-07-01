import type { AmazonListingSnapshot } from "./types";
import { formatMobilityChecklistForPrompt } from "./mobility-checklist";

export function buildListingAuditPrompt(snapshot: AmazonListingSnapshot): string {
  const listingJson = JSON.stringify(
    {
      asin: snapshot.asin,
      marketplace: snapshot.marketplace,
      title: snapshot.title,
      bullets: snapshot.bullets,
      description: snapshot.description ?? "",
      searchTerms: snapshot.searchTerms ?? "(not available from public page)",
      attributes: snapshot.attributes,
      browsePath: snapshot.browsePath ?? "",
    },
    null,
    2,
  );

  return `You are an Amazon Listing SEO auditor specializing in mobility aids, bathroom safety, and senior living products (US marketplace).

Audit the listing below and return ONE valid JSON object matching the schema exactly. No markdown.

## Amazon rules (2026)
- Title max 75 characters (non-media categories). Structure: Brand + core category + key attributes + use case. No keyword stuffing.
- Item Highlights: suggest one line max 125 characters (material, use, safety) — searchable supplement to title.
- Bullet points: each bullet should answer a buyer question. Avoid vague phrases like "high quality" or "perfect for daily use".
  Bullet roles: (1) core use/problem solved, (2) safety/material/stability, (3) size/fit/scenario, (4) install/ease of use, (5) audience/warranty.
- Backend Search Terms: synonyms, abbreviations, colloquial terms, scenario words. Do NOT repeat front-end words. Max ~250 bytes typical limit.
- Attributes: flag missing structured fields critical for filters and recommendations.
- Category: is browse path appropriate for bathroom safety vs generic medical?
- A+ Content: suggest module outlines only (not HTML).

## Category checklist
${formatMobilityChecklistForPrompt()}

## Listing to audit
${listingJson}

## Output JSON schema
{
  "overallScore": number (0-100),
  "summary": string (2-3 sentences in Simplified Chinese),
  "title": {
    "current": string,
    "charCount": number,
    "issues": [{ "severity": "high"|"medium"|"low", "area": "title", "message": string }],
    "suggested": string (max 75 chars, English)
  },
  "itemHighlights": {
    "suggested": string (max 125 chars, English),
    "charCount": number,
    "rationale": string (Simplified Chinese, brief)
  },
  "bullets": {
    "current": string[],
    "suggested": string[] (exactly 5 bullets, English),
    "issues": [{ "severity", "area": "bullets", "message" }]
  },
  "searchTerms": {
    "suggested": string (space-separated English, no repeats from title),
    "issues": [{ "severity", "area": "searchTerms", "message" }]
  },
  "attributes": {
    "missing": string[],
    "suggested": { "FieldName": "value" }
  },
  "aPlusOutline": string[] (3-6 module titles with brief intent in Chinese),
  "priorities": [{ "rank": 1-8, "item": string (Chinese), "reason": string (Chinese) }]
}

Issue "area" must be one of: title, highlights, bullets, searchTerms, attributes, category, aPlus, conversion.
Return JSON only.`;
}

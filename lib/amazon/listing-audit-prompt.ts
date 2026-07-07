import type { AmazonListingSnapshot } from "./types";
import { formatMobilityChecklistForPrompt } from "./mobility-checklist";
import { getAmazonAuditRules } from "./rules";

export function buildListingAuditPrompt(snapshot: AmazonListingSnapshot): string {
  const rules = getAmazonAuditRules(snapshot.marketplace as import("./types").AmazonMarketplace);
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

  return `You are an Amazon Listing SEO auditor specializing in mobility aids, bathroom safety, and senior living products.

Audit the listing below and return ONE valid JSON object matching the schema exactly. No markdown.
Return compact JSON only. Do not wrap in code fences. Do not add explanations before or after JSON.
Do not repeat large input fields that the server already knows, including the current title, current bullets, current description, or character counts derived from them.

## Review constraints
- Marketplace: ${snapshot.marketplace}.
- The following limits are optimization guidance, not universal Amazon policy. Never describe them as a confirmed violation unless the supplied basis says confirmed_rule.
- Title recommended max ${rules.title.recommendedMaxCharacters} characters. ${rules.title.label}. Structure: Brand + core category + key attributes + use case. No keyword stuffing.
- Item Highlights: suggest one line max ${rules.itemHighlights.recommendedMaxCharacters} characters. ${rules.itemHighlights.label}.
- Bullet points: each bullet should answer a buyer question. Avoid vague phrases like "high quality" or "perfect for daily use".
  Bullet roles: (1) core use/problem solved, (2) safety/material/stability, (3) size/fit/scenario, (4) install/ease of use, (5) audience/warranty.
- Backend Search Terms: synonyms, abbreviations, colloquial terms, scenario words. Do NOT repeat front-end words. Recommended max ~${rules.searchTerms.recommendedMaxBytes} bytes. ${rules.searchTerms.label}.
- Attributes: flag missing structured fields critical for filters and recommendations.
- Category: is browse path appropriate for bathroom safety vs generic medical?
- A+ Content: suggest module outlines only (not HTML).

## Category checklist
${formatMobilityChecklistForPrompt()}

## Listing to audit
${listingJson}

## Output JSON schema
{
  "schemaVersion": 2,
  "overallScore": number (0-100),
  "scoreBreakdown": {
    "compliance": number (0-100),
    "discoverability": number (0-100),
    "conversion": number (0-100),
    "completeness": number (0-100),
    "readability": number (0-100)
  },
  "summary": string (2-3 sentences in Simplified Chinese),
  "title": {
    "issues": [{ "id": string, "severity": "high"|"medium"|"low", "area": "title", "message": string, "impact": "compliance"|"discoverability"|"conversion"|"completeness"|"readability", "reason": string, "evidence": string[], "basisType": "confirmed_rule"|"listing_evidence"|"category_guidance"|"heuristic", "confidence": number (0-1) }],
    "suggested": string (max 75 chars, English)
  },
  "itemHighlights": {
    "suggested": string (max 125 chars, English),
    "rationale": string (Simplified Chinese, brief)
  },
  "bullets": {
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
  "priorities": [{ "rank": 1-8, "item": string (Chinese), "reason": string (Chinese), "issueIds": string[], "impact": "high"|"medium"|"low", "area": "title"|"highlights"|"bullets"|"searchTerms"|"attributes"|"category"|"aPlus"|"conversion" }]
}

Issue "area" must be one of: title, highlights, bullets, searchTerms, attributes, category, aPlus, conversion. Evidence must quote or precisely identify supplied listing content. Do not invent policy URLs, external sources, product facts, or confirmed rules.
If unsure about a field, use an empty string, empty array, or empty object instead of prose.
Before finishing, self-check that the response is valid parseable JSON.
Return JSON only.`;
}

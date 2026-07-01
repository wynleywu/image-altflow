import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAuditResult } from "./normalize-audit";
import type { AmazonListingSnapshot } from "./types";

const snapshot: AmazonListingSnapshot = {
  asin: "B000000001",
  marketplace: "US",
  url: "https://www.amazon.com/dp/B000000001",
  title: "Example Walker",
  bullets: ["Stable frame"],
  attributes: {},
  fetchedAt: "2026-07-01T00:00:00.000Z",
};

test("normalizes legacy audit payloads into schema v2", () => {
  const result = normalizeAuditResult({
    overallScore: 68,
    title: { suggested: "Better Walker", issues: [{ severity: "high", area: "title", message: "Too repetitive" }] },
    bullets: { suggested: ["Stable aluminum frame"], issues: [] },
    searchTerms: { suggested: "mobility aid", issues: [] },
  }, snapshot);

  assert.equal(result.schemaVersion, 2);
  assert.equal(result.scoreBreakdown.compliance, 68);
  assert.equal(result.title.issues[0].basisType, "heuristic");
  assert.equal(result.title.issues[0].confidence, 0.6);
  assert.match(result.title.issues[0].id, /^title-1-/);
});

test("clamps unsafe values and rejects unknown enums", () => {
  const result = normalizeAuditResult({
    overallScore: 150,
    scoreBreakdown: { compliance: -2, conversion: "bad" },
    title: {
      issues: [{
        severity: "critical",
        area: "unknown",
        message: "Needs review",
        impact: "sales",
        basisType: "external_url",
        confidence: 4,
      }],
    },
  }, snapshot);

  assert.equal(result.overallScore, 100);
  assert.equal(result.scoreBreakdown.compliance, 0);
  assert.equal(result.scoreBreakdown.conversion, 100);
  assert.equal(result.title.issues[0].severity, "medium");
  assert.equal(result.title.issues[0].area, "title");
  assert.equal(result.title.issues[0].basisType, "heuristic");
  assert.equal(result.title.issues[0].confidence, 1);
});

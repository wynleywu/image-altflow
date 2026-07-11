import assert from "node:assert/strict";
import test from "node:test";
import { createAuditWorkspace, loadAuditWorkspace, saveAuditWorkspace } from "./workspace";
import type { AmazonListingSnapshot, ListingAuditResult } from "./types";

class MemoryStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true });

const snapshot: AmazonListingSnapshot = {
  asin: "B000000001",
  marketplace: "US",
  url: "https://www.amazon.com/dp/B000000001",
  title: "Example Walker",
  bullets: ["Stable frame"],
  attributes: {},
  fetchedAt: "2026-07-01T00:00:00.000Z",
};

const audit = {
  overallScore: 75,
  title: { suggested: "Better Walker", issues: [] },
  itemHighlights: { suggested: "Stable frame", rationale: "Clear" },
  bullets: { suggested: ["Stable frame"], issues: [] },
  searchTerms: { suggested: "mobility aid", issues: [] },
  attributes: {},
} as unknown as ListingAuditResult;

test("persists draft and accepted state by audit id", () => {
  localStorage.clear();
  const workspace = createAuditWorkspace("audit-a", snapshot, audit);
  workspace.draft.title = "Edited title";
  workspace.accepted.title = true;
  saveAuditWorkspace(workspace);

  const restored = loadAuditWorkspace("audit-a");
  assert.equal(restored?.draft.title, "Edited title");
  assert.equal(restored?.accepted.title, true);
  assert.equal(loadAuditWorkspace("audit-b"), null);
});

test("retains only the ten most recently saved workspaces", () => {
  localStorage.clear();
  for (let index = 0; index < 11; index++) {
    saveAuditWorkspace(createAuditWorkspace(`audit-${index}`, snapshot, audit));
  }
  assert.equal(loadAuditWorkspace("audit-0"), null);
  assert.notEqual(loadAuditWorkspace("audit-10"), null);
});

test("ignores stale workspace entries from the previous cache version", () => {
  localStorage.clear();
  localStorage.setItem("amazon_audit_workspace:v2:audit-stale", JSON.stringify({
    version: 1,
    auditId: "audit-stale",
    snapshot,
    audit,
    draft: { title: "Old", itemHighlights: "", bullets: [], searchTerms: "" },
    accepted: { title: false, highlights: false, bullets: false, searchTerms: false },
    createdAt: 1,
    updatedAt: 1,
  }));

  assert.equal(loadAuditWorkspace("audit-stale"), null);
});

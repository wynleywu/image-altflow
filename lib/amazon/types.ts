export interface AmazonListingSnapshot {
  asin: string;
  marketplace: string;
  url: string;
  title: string;
  bullets: string[];
  description?: string;
  searchTerms?: string;
  attributes: Record<string, string>;
  browsePath?: string;
  mainImageUrl?: string;
  fetchedAt: string;
}

export type ListingAuditArea =
  | "title"
  | "highlights"
  | "bullets"
  | "searchTerms"
  | "attributes"
  | "category"
  | "aPlus"
  | "conversion";

export type ListingAuditImpact = "compliance" | "discoverability" | "conversion" | "completeness" | "readability";
export type ListingAuditBasisType = "confirmed_rule" | "listing_evidence" | "category_guidance" | "heuristic";

export interface ListingAuditIssue {
  id: string;
  severity: "high" | "medium" | "low";
  area: ListingAuditArea;
  message: string;
  impact: ListingAuditImpact;
  reason: string;
  evidence: string[];
  basisType: ListingAuditBasisType;
  confidence: number;
}

export interface ListingAuditScoreBreakdown {
  compliance: number;
  discoverability: number;
  conversion: number;
  completeness: number;
  readability: number;
}

export interface ListingAuditResult {
  schemaVersion: 2;
  overallScore: number;
  scoreBreakdown: ListingAuditScoreBreakdown;
  summary: string;
  title: {
    current: string;
    charCount: number;
    issues: ListingAuditIssue[];
    suggested: string;
  };
  itemHighlights: {
    suggested: string;
    charCount: number;
    rationale: string;
  };
  bullets: {
    current: string[];
    suggested: string[];
    issues: ListingAuditIssue[];
  };
  searchTerms: {
    suggested: string;
    issues: ListingAuditIssue[];
  };
  attributes: {
    missing: string[];
    suggested: Record<string, string>;
  };
  aPlusOutline: string[];
  priorities: {
    rank: number;
    item: string;
    reason: string;
    issueIds: string[];
    impact: "high" | "medium" | "low";
    area: ListingAuditArea;
  }[];
}

export type AmazonAuditEditableSection = "title" | "highlights" | "bullets" | "searchTerms";

export interface AmazonAuditDraft {
  title: string;
  itemHighlights: string;
  bullets: string[];
  searchTerms: string;
}

export interface AmazonAuditWorkspace {
  version: 1;
  auditId: string;
  snapshot: AmazonListingSnapshot;
  audit: ListingAuditResult;
  draft: AmazonAuditDraft;
  accepted: Record<AmazonAuditEditableSection, boolean>;
  createdAt: number;
  updatedAt: number;
}

export type AmazonMarketplace = "US" | "UK" | "DE" | "CA" | "AU";

export const MARKETPLACE_DOMAINS: Record<AmazonMarketplace, string> = {
  US: "amazon.com",
  UK: "amazon.co.uk",
  DE: "amazon.de",
  CA: "amazon.ca",
  AU: "amazon.com.au",
};

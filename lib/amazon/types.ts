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

export interface ListingAuditIssue {
  severity: "high" | "medium" | "low";
  area: ListingAuditArea;
  message: string;
}

export interface ListingAuditResult {
  overallScore: number;
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
  priorities: { rank: number; item: string; reason: string }[];
}

export type AmazonMarketplace = "US" | "UK" | "DE" | "CA" | "AU";

export const MARKETPLACE_DOMAINS: Record<AmazonMarketplace, string> = {
  US: "amazon.com",
  UK: "amazon.co.uk",
  DE: "amazon.de",
  CA: "amazon.ca",
  AU: "amazon.com.au",
};

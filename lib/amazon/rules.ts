import type { AmazonMarketplace } from "./types";

export interface AmazonAuditRuleSet {
  marketplace: AmazonMarketplace;
  title: {
    recommendedMaxCharacters: number;
    basis: "category_guidance";
    label: string;
  };
  itemHighlights: {
    recommendedMaxCharacters: number;
    basis: "heuristic";
    label: string;
  };
  searchTerms: {
    recommendedMaxBytes: number;
    basis: "category_guidance";
    label: string;
  };
}

const DEFAULT_RULES: Omit<AmazonAuditRuleSet, "marketplace"> = {
  title: {
    recommendedMaxCharacters: 75,
    basis: "category_guidance",
    label: "当前类目优化建议，不作为平台违规结论",
  },
  itemHighlights: {
    recommendedMaxCharacters: 125,
    basis: "heuristic",
    label: "可读性与搜索覆盖建议",
  },
  searchTerms: {
    recommendedMaxBytes: 250,
    basis: "category_guidance",
    label: "后台搜索词容量建议，实际限制以 Seller Central 为准",
  },
};

export function getAmazonAuditRules(marketplace: AmazonMarketplace): AmazonAuditRuleSet {
  return { marketplace, ...DEFAULT_RULES };
}

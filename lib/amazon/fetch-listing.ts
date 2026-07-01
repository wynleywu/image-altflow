import { buildAmazonProductUrl } from "./asin";
import { fetchListingViaModelScope } from "./fetch-via-modelscope";
import type { AmazonListingSnapshot, AmazonMarketplace } from "./types";
import { MARKETPLACE_DOMAINS } from "./types";
import { hasTextLlmProvider, readAmazonEnv, getAmazonTextProvider } from "./text-llm";

type RainforestProduct = {
  asin?: string;
  title?: string;
  link?: string;
  feature_bullets?: string[];
  description?: string;
  brand?: string;
  categories?: { name?: string }[];
  category_tree?: { name?: string }[];
  main_image?: { link?: string };
  specifications?: { name?: string; value?: string }[];
  specifications_flat?: Record<string, string>;
  keywords?: string;
};

function mapSpecifications(product: RainforestProduct): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (product.brand) {
    attrs.Brand = product.brand;
  }
  if (product.specifications_flat) {
    for (const [key, value] of Object.entries(product.specifications_flat)) {
      if (value) attrs[key] = String(value);
    }
  }
  if (product.specifications) {
    for (const spec of product.specifications) {
      if (spec.name && spec.value) {
        attrs[spec.name] = spec.value;
      }
    }
  }
  return attrs;
}

function mapBrowsePath(product: RainforestProduct): string | undefined {
  const tree = product.category_tree ?? product.categories;
  if (!tree?.length) return undefined;
  return tree.map((c) => c.name).filter(Boolean).join(" > ");
}

async function fetchFromRainforest(asin: string, marketplace: AmazonMarketplace): Promise<AmazonListingSnapshot> {
  const apiKey = readAmazonEnv("RAINFOREST_API_KEY");
  if (!apiKey) {
    throw new Error("fetch_not_configured: RAINFOREST_API_KEY is not set");
  }

  const amazonDomain = MARKETPLACE_DOMAINS[marketplace];
  const url = new URL("https://api.rainforestapi.com/request");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("type", "product");
  url.searchParams.set("amazon_domain", amazonDomain);
  url.searchParams.set("asin", asin);

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`fetch_failed: Rainforest API ${response.status}: ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as { product?: RainforestProduct };
  const product = json.product;
  if (!product?.title) {
    throw new Error("fetch_failed: Product not found or empty response");
  }

  const resolvedAsin = (product.asin ?? asin).toUpperCase();
  return {
    asin: resolvedAsin,
    marketplace,
    url: product.link ?? buildAmazonProductUrl(resolvedAsin, marketplace),
    title: product.title,
    bullets: (product.feature_bullets ?? []).filter(Boolean),
    description: product.description,
    searchTerms: product.keywords,
    attributes: mapSpecifications(product),
    browsePath: mapBrowsePath(product),
    mainImageUrl: product.main_image?.link,
    fetchedAt: new Date().toISOString(),
  };
}

export function normalizeManualSnapshot(
  manual: Partial<AmazonListingSnapshot> & { asin?: string; title: string },
  marketplace: AmazonMarketplace,
): AmazonListingSnapshot {
  const asin = (manual.asin ?? "MANUAL0000").toUpperCase();
  return {
    asin,
    marketplace,
    url: manual.url ?? buildAmazonProductUrl(asin === "MANUAL0000" ? "B000000000" : asin, marketplace),
    title: manual.title.trim(),
    bullets: (manual.bullets ?? []).map((b) => b.trim()).filter(Boolean),
    description: manual.description?.trim(),
    searchTerms: manual.searchTerms?.trim(),
    attributes: manual.attributes ?? {},
    browsePath: manual.browsePath,
    mainImageUrl: manual.mainImageUrl,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchAmazonListing(
  asin: string,
  marketplace: AmazonMarketplace = "US",
): Promise<AmazonListingSnapshot> {
  if (readAmazonEnv("RAINFOREST_API_KEY")) {
    return fetchFromRainforest(asin, marketplace);
  }
  if (hasTextLlmProvider()) {
    return fetchListingViaModelScope(asin, marketplace);
  }
  throw new Error("fetch_not_configured: set GEMINI_API_KEY, MODELSCOPE_API_KEY, or RAINFOREST_API_KEY");
}

export function canFetchAmazonListing(): boolean {
  return Boolean(readAmazonEnv("RAINFOREST_API_KEY") || hasTextLlmProvider());
}

export function fetchProviderLabel(): "rainforest" | "gemini" | "modelscope" | "none" {
  if (readAmazonEnv("RAINFOREST_API_KEY")) return "rainforest";
  if (hasTextLlmProvider()) return getAmazonTextProvider();
  return "none";
}

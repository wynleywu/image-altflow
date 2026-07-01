import { stripMarkdownFence } from "@/lib/gemini";
import type { AmazonListingSnapshot, AmazonMarketplace } from "./types";
import { callTextLlm } from "./text-llm";
import { buildAmazonProductUrl } from "./asin";

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\u0022")
    .replace(/&#39;/g, "\u0027")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

function unescapeJsonString(raw: string): string {
  return raw.replace(/\\u0026/g, "&").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function extractTitle(html: string): string | undefined {
  const patterns: RegExp[] = [
    /id="productTitle"[^>]*>([\s\S]*?)<\/span>/i,
    /<span[^>]*id="productTitle"[^>]*>([\s\S]*?)<\/span>/i,
    /property="og:title"\s+content="([^"]+)"/i,
    /name="title"\s+content="([^"]+)"/i,
    /"productTitle"\s*:\s*"((?:\\.|[^"\\])*)"/,
    /"title"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"variant"/,
    /class="a-size-large[^"]*product-title-word-break"[^>]*>([\s\S]*?)<\/span>/i,
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    const raw = m?.[1];
    if (!raw) continue;
    const title = stripTags(unescapeJsonString(raw));
    if (title.length >= 8 && title.length < 500) {
      return title;
    }
  }
  return undefined;
}

function extractFeatureBullets(html: string): string[] {
  const bullets: string[] = [];
  const sectionMatch =
    html.match(/id="feature-bullets"[\s\S]{0,12000}?<\/ul>/i)
    ?? html.match(/id="featurebullets_feature_div"[\s\S]{0,12000}?<\/ul>/i);

  const section = sectionMatch?.[0] ?? html;
  const itemPatterns = [
    /<span[^>]*class="[^"]*a-list-item[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    /<li[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi,
  ];

  for (const pattern of itemPatterns) {
    for (const m of section.matchAll(pattern)) {
      const text = stripTags(m[1]);
      if (text.length < 12 || text.length > 600) continue;
      if (bullets.includes(text)) continue;
      bullets.push(text);
      if (bullets.length >= 5) return bullets;
    }
    if (bullets.length > 0) return bullets;
  }

  return bullets;
}

function extractFromMarkdown(markdown: string): Partial<ReturnType<typeof extractListingFromAmazonHtml>> {
  const result: Partial<ReturnType<typeof extractListingFromAmazonHtml>> = {
    bullets: [],
    attributes: {},
  };

  const lines = markdown.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const h1 = lines.find((l) => l.startsWith("# "));
    if (h1) result.title = h1.replace(/^#\s+/, "").trim();
    else if (!lines[0].startsWith("http")) result.title = lines[0];
  }

  const bulletLines = lines.filter((l) => /^[-*•]\s+/.test(l) || /^\d+\.\s+/.test(l));
  result.bullets = bulletLines
    .map((l) => l.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "").trim())
    .filter((t) => t.length >= 12)
    .slice(0, 5);

  return result;
}

/** Extract listing fields directly from Amazon HTML (title is often far below the 32KB mark). */
export function extractListingFromAmazonHtml(html: string): Partial<{
  title: string;
  bullets: string[];
  description: string;
  mainImageUrl: string;
  browsePath: string;
  attributes: Record<string, string>;
}> {
  const result: ReturnType<typeof extractListingFromAmazonHtml> = {
    bullets: [],
    attributes: {},
  };

  result.title = extractTitle(html);
  result.bullets = extractFeatureBullets(html);

  const descMatch =
    html.match(/id="productDescription"[^>]*>([\s\S]*?)<\/div>/i)
    ?? html.match(/id="aplus"[^>]*>([\s\S]{0,4000})/i);
  if (descMatch?.[1]) {
    result.description = stripTags(descMatch[1]).slice(0, 2000);
  }

  const imgMatch =
    html.match(/"hiRes":"(https:\/\/[^"]+)"/)
    ?? html.match(/property="og:image"\s+content="([^"]+)"/i)
    ?? html.match(/id="landingImage"[^>]*src="([^"]+)"/i);
  if (imgMatch?.[1]) {
    result.mainImageUrl = unescapeJsonString(imgMatch[1]);
  }

  const wayfinding = html.match(/id="wayfinding-breadcrumbs[^"]*"[\s\S]{0,3000}?<\/ul>/i);
  if (wayfinding?.[0]) {
    const crumbs: string[] = [];
    for (const m of wayfinding[0].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)) {
      const text = stripTags(m[1]);
      if (text && text.length < 80) crumbs.push(text);
    }
    if (crumbs.length > 0) result.browsePath = crumbs.join(" > ");
  }

  const brandMatch = html.match(/"brand"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (brandMatch?.[1]) {
    result.attributes!.Brand = unescapeJsonString(brandMatch[1]);
  }

  return result;
}

function buildCompactPageExcerpt(html: string, markdown?: string): string {
  const extracted = markdown ? { ...extractListingFromAmazonHtml(html), ...extractFromMarkdown(markdown) } : extractListingFromAmazonHtml(html);
  const parts: string[] = [];

  if (extracted.title) parts.push(`TITLE: ${extracted.title}`);
  if (extracted.bullets?.length) {
    parts.push("BULLETS:\n" + extracted.bullets.map((b, i) => `${i + 1}. ${b}`).join("\n"));
  }
  if (extracted.description) parts.push(`DESCRIPTION: ${extracted.description}`);
  if (extracted.browsePath) parts.push(`BROWSE: ${extracted.browsePath}`);
  if (extracted.mainImageUrl) parts.push(`IMAGE: ${extracted.mainImageUrl}`);
  if (markdown) parts.push("MARKDOWN:\n" + markdown.slice(0, 8000));

  const attrSnippets = html.match(/<th[^>]*>[\s\S]*?<\/th>[\s\S]*?<td[^>]*>[\s\S]*?<\/td>/gi);
  if (attrSnippets) {
    const rows = attrSnippets
      .slice(0, 30)
      .map((row) => stripTags(row));
    parts.push("SPEC_TABLE:\n" + rows.join("\n"));
  }

  if (parts.length > 0) {
    return parts.join("\n\n").slice(0, 14000);
  }

  return (markdown ?? html).slice(0, 32000);
}

function buildParseListingPrompt(
  pageContent: string,
  asin: string,
  marketplace: AmazonMarketplace,
  productUrl: string,
): string {
  return `You extract structured Amazon product listing data from page HTML or markdown text.
Return ONE valid JSON object only. No markdown.

Product URL: ${productUrl}
ASIN: ${asin}
Marketplace: ${marketplace}

Extract only what is present. Do not invent specs.
If a field is missing, use empty string or empty array/object.

JSON schema:
{
  "title": string,
  "bullets": string[],
  "description": string,
  "browsePath": string,
  "mainImageUrl": string,
  "attributes": { "FieldName": "value" }
}

Page content:
${pageContent}`;
}

function mergeExtractedWithParsed(
  extracted: ReturnType<typeof extractListingFromAmazonHtml>,
  parsed: Record<string, unknown>,
  asin: string,
): Omit<AmazonListingSnapshot, "fetchedAt" | "marketplace" | "url" | "searchTerms"> {
  const llmTitle = String(parsed.title ?? "").trim();
  const llmBullets = Array.isArray(parsed.bullets) ? parsed.bullets.map(String).filter(Boolean) : [];

  const title = (extracted.title || llmTitle).trim();
  const bullets = (extracted.bullets?.length ? extracted.bullets : llmBullets) ?? [];

  const llmAttrs =
    parsed.attributes && typeof parsed.attributes === "object" && !Array.isArray(parsed.attributes)
      ? Object.fromEntries(
          Object.entries(parsed.attributes as Record<string, unknown>)
            .map(([k, v]) => [k, String(v)])
            .filter(([, v]) => v),
        )
      : {};

  return {
    asin: asin.toUpperCase(),
    title,
    bullets,
    description: extracted.description || String(parsed.description ?? "").trim() || undefined,
    attributes: { ...llmAttrs, ...extracted.attributes },
    browsePath: extracted.browsePath || String(parsed.browsePath ?? "").trim() || undefined,
    mainImageUrl: extracted.mainImageUrl || String(parsed.mainImageUrl ?? "").trim() || undefined,
  };
}

function isBlockedAmazonHtml(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("robot check")
    || lower.includes("type the characters you see")
    || lower.includes("sorry, we just need to make sure you're not a robot")
    || lower.includes("enter the characters you see below")
  );
}

export async function fetchProductPageContent(productUrl: string): Promise<string> {
  const response = await fetch(productUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    throw new Error(`fetch_failed: HTTP ${response.status} for product page`);
  }

  const html = await response.text();
  if (isBlockedAmazonHtml(html)) {
    throw new Error("fetch_failed: Amazon 拦截了自动访问，请改用手动粘贴 Listing");
  }

  return html;
}

async function fetchViaJinaReader(productUrl: string): Promise<string> {
  const readerUrl = `https://r.jina.ai/${productUrl}`;
  const response = await fetch(readerUrl, {
    headers: {
      Accept: "text/plain",
      "User-Agent": "altflow-amazon-audit/1.0",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`fetch_failed: reader proxy HTTP ${response.status}`);
  }

  const text = await response.text();
  if (!text.trim() || text.length < 200) {
    throw new Error("fetch_failed: reader proxy returned empty content");
  }
  return text;
}

export async function parseListingFromPageContent(
  pageContent: string,
  asin: string,
  marketplace: AmazonMarketplace,
  productUrl: string,
  fullHtml?: string,
  markdownFallback?: string,
): Promise<Omit<AmazonListingSnapshot, "fetchedAt" | "marketplace" | "url" | "searchTerms">> {
  const html = fullHtml ?? pageContent;
  const mdExtracted = markdownFallback ? extractFromMarkdown(markdownFallback) : {};
  const htmlExtracted = extractListingFromAmazonHtml(html);
  const extracted = {
    ...htmlExtracted,
    title: htmlExtracted.title || mdExtracted.title,
    bullets: (htmlExtracted.bullets?.length ? htmlExtracted.bullets : mdExtracted.bullets) ?? [],
    description: htmlExtracted.description || mdExtracted.description,
    browsePath: htmlExtracted.browsePath || mdExtracted.browsePath,
    mainImageUrl: htmlExtracted.mainImageUrl || mdExtracted.mainImageUrl,
    attributes: { ...mdExtracted.attributes, ...htmlExtracted.attributes },
  };

  if (extracted.title) {
    return mergeExtractedWithParsed(extracted, {}, asin);
  }

  const excerpt = buildCompactPageExcerpt(html, markdownFallback);
  const prompt = buildParseListingPrompt(excerpt, asin, marketplace, productUrl);
  const text = await callTextLlm(prompt);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripMarkdownFence(text));
  } catch {
    if (extracted.title) {
      return mergeExtractedWithParsed(extracted, {}, asin);
    }
    throw new Error("ai_parse_error: failed to parse listing JSON from page");
  }

  const merged = mergeExtractedWithParsed(extracted, parsed, asin);
  if (!merged.title) {
    throw new Error(
      "fetch_failed: 无法从该 ASIN 获取 Listing（Amazon 可能限制访问或站点不匹配）。请改用手动粘贴 Listing。",
    );
  }

  return merged;
}

export async function fetchListingViaModelScope(
  asin: string,
  marketplace: AmazonMarketplace,
): Promise<AmazonListingSnapshot> {
  const productUrl = buildAmazonProductUrl(asin, marketplace);
  let html = "";
  let markdown: string | undefined;

  try {
    html = await fetchProductPageContent(productUrl);
  } catch {
    html = "";
  }

  let extracted = html ? extractListingFromAmazonHtml(html) : {};

  if (!extracted.title) {
    try {
      markdown = await fetchViaJinaReader(productUrl);
      const mdData = extractFromMarkdown(markdown);
      extracted = {
        ...extracted,
        title: mdData.title,
        bullets: mdData.bullets ?? [],
      };
    } catch {
      // fall through to parse error below
    }
  }

  const parsed = await parseListingFromPageContent(
    html || markdown || "",
    asin,
    marketplace,
    productUrl,
    html || undefined,
    markdown,
  );

  return {
    ...parsed,
    marketplace,
    url: productUrl,
    fetchedAt: new Date().toISOString(),
  };
}

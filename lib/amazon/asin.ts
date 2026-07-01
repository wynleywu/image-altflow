const ASIN_PATTERN = /\b([A-Z0-9]{10})\b/i;

export function isValidAsin(asin: string): boolean {
  return /^[A-Z0-9]{10}$/i.test(asin.trim());
}

export function parseAsinFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isValidAsin(trimmed)) {
    return trimmed.toUpperCase();
  }

  try {
    const url = trimmed.startsWith("http") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const host = url.hostname.toLowerCase();
    if (!host.includes("amazon.")) {
      return null;
    }

    const dpMatch = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
    if (dpMatch?.[1]) {
      return dpMatch[1].toUpperCase();
    }

    const asinParam = url.searchParams.get("asin");
    if (asinParam && isValidAsin(asinParam)) {
      return asinParam.toUpperCase();
    }
  } catch {
    // fall through to regex
  }

  const match = trimmed.match(ASIN_PATTERN);
  return match?.[1] ? match[1].toUpperCase() : null;
}

export function buildAmazonProductUrl(asin: string, marketplace: string): string {
  const domain =
    marketplace === "UK"
      ? "amazon.co.uk"
      : marketplace === "DE"
        ? "amazon.de"
        : marketplace === "CA"
          ? "amazon.ca"
          : marketplace === "AU"
            ? "amazon.com.au"
            : "amazon.com";
  return `https://www.${domain}/dp/${asin}`;
}

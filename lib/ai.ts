import type { AiImageResult } from "./types";

type ProviderName = "modelscope" | "cloudflare" | "gemini";

function readPreferredProvider(): ProviderName {
  const raw = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "gemini" || raw === "cloudflare" || raw === "modelscope") return raw;
  return "modelscope";
}

function isProviderConfigured(name: ProviderName): boolean {
  if (name === "modelscope") return Boolean(process.env.MODELSCOPE_API_KEY?.trim());
  if (name === "cloudflare") {
    return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim());
  }
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function providerOrder(preferred: ProviderName): ProviderName[] {
  const rest: ProviderName[] = (["modelscope", "cloudflare", "gemini"] as const).filter((p) => p !== preferred);
  return [preferred, ...rest];
}

async function callProvider(
  name: ProviderName,
  buffer: Buffer,
  mimeType: string,
  opts?: { brand?: string; model?: string },
): Promise<AiImageResult> {
  if (name === "modelscope") {
    const { analyzeImageFromBuffer: ms } = await import("./modelscope");
    return ms(buffer, mimeType, opts);
  }
  if (name === "cloudflare") {
    const { analyzeImageFromBuffer: cf } = await import("./cloudflare");
    return cf(buffer, mimeType, opts);
  }
  const { analyzeImageFromBuffer: gemini } = await import("./gemini");
  return gemini(buffer, mimeType, opts);
}

export async function analyzeImageFromBuffer(
  buffer: Buffer,
  mimeType: string,
  opts?: { brand?: string; model?: string },
): Promise<AiImageResult> {
  const preferred = readPreferredProvider();
  const order = providerOrder(preferred);
  const errors: string[] = [];

  for (const name of order) {
    if (!isProviderConfigured(name)) continue;
    try {
      return await callProvider(name, buffer, mimeType, opts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${name}: ${message}`);
      console.warn(`[ai] ${name} failed, trying next:`, message);
    }
  }

  if (errors.length === 0) {
    throw new Error(
      "No AI provider available. Please configure MODELSCOPE_API_KEY, CLOUDFLARE credentials, or GEMINI_API_KEY.",
    );
  }

  throw new Error(`All AI providers failed. ${errors.join(" | ")}`);
}

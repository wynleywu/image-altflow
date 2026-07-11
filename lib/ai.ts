import type { AiImageResult } from "./types";

type ProviderName = "modelscope" | "cloudflare" | "gemini";

const ANALYZE_TIMEOUT_BUDGET_MS = 55_000;
const MAX_PROVIDER_TIMEOUT_MS = 25_000;

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
  timeoutMs = MAX_PROVIDER_TIMEOUT_MS,
): Promise<AiImageResult> {
  if (name === "modelscope") {
    const { analyzeImageFromBuffer: ms } = await import("./modelscope");
    return ms(buffer, mimeType, opts, timeoutMs);
  }
  if (name === "cloudflare") {
    const { analyzeImageFromBuffer: cf } = await import("./cloudflare");
    return cf(buffer, mimeType, opts, timeoutMs);
  }
  const { analyzeImageFromBuffer: gemini } = await import("./gemini");
  return gemini(buffer, mimeType, opts, timeoutMs);
}

export async function analyzeImageFromBuffer(
  buffer: Buffer,
  mimeType: string,
  opts?: { brand?: string; model?: string },
): Promise<AiImageResult> {
  const preferred = readPreferredProvider();
  const order = providerOrder(preferred);
  const errors: string[] = [];
  const deadline = Date.now() + ANALYZE_TIMEOUT_BUDGET_MS;

  for (let index = 0; index < order.length; index += 1) {
    const name = order[index];
    if (!isProviderConfigured(name)) continue;

    const remainingProviders = order
      .slice(index)
      .filter((provider) => isProviderConfigured(provider)).length;
    const remainingBudget = deadline - Date.now();
    if (remainingBudget <= 0) {
      errors.push(`${name}: analyze timeout budget exhausted`);
      break;
    }
    const timeoutMs = Math.max(
      1_000,
      Math.min(MAX_PROVIDER_TIMEOUT_MS, Math.floor(remainingBudget / remainingProviders)),
    );

    try {
      return await callProvider(name, buffer, mimeType, opts, timeoutMs);
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

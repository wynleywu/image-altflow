import type { AiImageResult } from "./types";

export async function analyzeImageFromBuffer(buffer: Buffer, mimeType: string, opts?: { brand?: string; model?: string }): Promise<AiImageResult> {
  // 1. ModelScope
  if (process.env.MODELSCOPE_API_KEY) {
    try {
      const { analyzeImageFromBuffer: ms } = await import("./modelscope");
      return await ms(buffer, mimeType, opts);
    } catch (err) {
      console.warn("[ai] ModelScope failed, trying Cloudflare:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Cloudflare
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    try {
      const { analyzeImageFromBuffer: cf } = await import("./cloudflare");
      return await cf(buffer, mimeType, opts);
    } catch (err) {
      console.warn("[ai] Cloudflare failed, trying Gemini:", err instanceof Error ? err.message : err);
    }
  }

  // 3. Gemini fallback
  if (process.env.GEMINI_API_KEY) {
    const { analyzeImageFromBuffer: gemini } = await import("./gemini");
    return gemini(buffer, mimeType, opts);
  }

  throw new Error("No AI provider available. Please configure MODELSCOPE_API_KEY, CLOUDFLARE credentials, or GEMINI_API_KEY.");
}

import type { AiImageResult } from "./types";

export async function analyzeImageFromBuffer(buffer: Buffer, mimeType: string): Promise<AiImageResult> {
  const provider = process.env.AI_PROVIDER || "modelscope";

  if (provider === "gemini") {
    const { analyzeImageFromBuffer: gemini } = await import("./gemini");
    return gemini(buffer, mimeType);
  }

  // Default: ModelScope, fall back to Gemini on any error
  try {
    const { analyzeImageFromBuffer: ms } = await import("./modelscope");
    return await ms(buffer, mimeType);
  } catch (err) {
    if (!process.env.GEMINI_API_KEY) throw err;
    console.warn("[ai] ModelScope failed, falling back to Gemini:", err instanceof Error ? err.message : err);
    const { analyzeImageFromBuffer: gemini } = await import("./gemini");
    return gemini(buffer, mimeType);
  }
}

import type { AiImageResult } from "./types";
import { AI_PROMPT } from "./prompt";
import { normalizeAiResult } from "./gemini";

const MODELSCOPE_BASE_URL = "https://api-inference.modelscope.cn/v1";

function stripMarkdownFence(text: string): string {
  let cleaned = text.trim();
  const fence = "```";
  if (cleaned.startsWith(fence)) {
    cleaned = cleaned.slice(fence.length);
    if (cleaned.toLowerCase().startsWith("json")) {
      cleaned = cleaned.slice(4);
    }
    if (cleaned.endsWith(fence)) {
      cleaned = cleaned.slice(0, -fence.length);
    }
    cleaned = cleaned.trim();
  }
  return cleaned;
}

export async function analyzeImageFromBuffer(buffer: Buffer, mimeType: string): Promise<AiImageResult> {
  const rawKey = process.env.MODELSCOPE_API_KEY ?? "";
  // U+FEFF BOM may appear when .env.local is saved with BOM encoding on Windows
  const apiKey = (rawKey.charCodeAt(0) === 0xFEFF ? rawKey.slice(1) : rawKey).trim();
  if (!apiKey) {
    throw new Error("MODELSCOPE_API_KEY is not configured");
  }

  const rawModel = process.env.MODELSCOPE_MODEL ?? "";
  const model = (rawModel.charCodeAt(0) === 0xFEFF ? rawModel.slice(1) : rawModel).trim()
    || "Qwen/Qwen2.5-VL-72B-Instruct";
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const response = await fetch(`${MODELSCOPE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: AI_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ModelScope API error ${response.status}: ${body}`);
  }

  const json = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };

  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new Error("ai_parse_error: ModelScope returned empty content");
  }

  let parsed: Partial<AiImageResult> & Record<string, unknown>;
  try {
    parsed = JSON.parse(stripMarkdownFence(text));
  } catch {
    throw new Error("ai_parse_error: ModelScope returned invalid JSON");
  }

  return normalizeAiResult(parsed);
}

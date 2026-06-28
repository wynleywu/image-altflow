import type { AiImageResult } from "./types";
import { buildPrompt } from "./prompt";
import { normalizeAiResult, stripMarkdownFence } from "./gemini";

const MODELSCOPE_BASE_URL = "https://api-inference.modelscope.cn/v1";

function readEnv(key: string): string {
  const raw = process.env[key] ?? "";
  return (raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw).trim();
}

const apiKey = readEnv("MODELSCOPE_API_KEY");
const model = readEnv("MODELSCOPE_MODEL") || "Qwen/Qwen3-VL-30B-A3B-Instruct";

export async function analyzeImageFromBuffer(buffer: Buffer, mimeType: string, opts?: { brand?: string; model?: string }): Promise<AiImageResult> {
  if (!apiKey) {
    throw new Error("MODELSCOPE_API_KEY is not configured");
  }

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
            { type: "text", text: buildPrompt(opts) },
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

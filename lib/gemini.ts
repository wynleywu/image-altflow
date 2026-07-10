import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiImageResult } from "./types";
import { buildPrompt } from "./prompt";

const REQUIRED_FIELDS: (keyof AiImageResult)[] = [
  "image_description_en",
  "new_file_name",
  "alt_text_en",
  "caption_en",
];
const DEFAULT_REQUEST_TIMEOUT_MS = 25_000;

export function stripMarkdownFence(text: string): string {
  let cleaned = text.trim();
  // Strip Qwen3 / reasoning-model <think>...</think> blocks
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
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

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(/[,/\uFF0C\u3001]/).map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

export function normalizeAiResult(raw: Partial<AiImageResult> & Record<string, unknown>): AiImageResult {
  const altEn = String(raw.alt_text_en ?? raw.alt_text ?? "");
  const altZh = String(raw.alt_text_zh ?? "");
  const captionEn = String(raw.caption_en ?? raw.caption ?? altEn);
  const captionZh = String(raw.caption_zh ?? altZh);

  return {
    image_description_en: String(raw.image_description_en ?? raw.image_description ?? ""),
    image_description_zh: String(raw.image_description_zh ?? ""),
    new_file_name: String(raw.new_file_name ?? ""),
    alt_text_en: altEn,
    alt_text_zh: altZh,
    caption_en: captionEn,
    caption_zh: captionZh,
    tags_en: parseTags(raw.tags_en ?? raw.tags),
    tags_zh: parseTags(raw.tags_zh),
    product_type_en: String(raw.product_type_en ?? raw.product_type ?? ""),
    product_type_zh: String(raw.product_type_zh ?? ""),
    main_color_en: String(raw.main_color_en ?? raw.main_color ?? "uncertain"),
    main_color_zh: String(raw.main_color_zh ?? ""),
    scene_en: String(raw.scene_en ?? raw.scene ?? "uncertain"),
    scene_zh: String(raw.scene_zh ?? ""),
    confidence_note: raw.confidence_note === "uncertain" ? "uncertain" : "certain",
    ...(typeof raw.brand === "string" && raw.brand.trim()
      ? { brand: raw.brand.trim() }
      : {}),
    ...(typeof raw.model === "string" && raw.model.trim()
      ? { model: raw.model.trim() }
      : {}),
  };
}

async function callGeminiWithInlineData(
  data: string,
  mimeType: string,
  opts?: { brand?: string; model?: string },
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<AiImageResult> {
  const rawKey = process.env.GEMINI_API_KEY ?? "";
  const apiKey = (rawKey.charCodeAt(0) === 0xfeff ? rawKey.slice(1) : rawKey).trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const rawModel = process.env.GEMINI_MODEL ?? "";
  const modelName = (rawModel.charCodeAt(0) === 0xfeff ? rawModel.slice(1) : rawModel).trim()
    || "gemini-3.1-flash-lite";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  let result;
  try {
    result = await model.generateContent(
      [buildPrompt(opts), { inlineData: { data, mimeType } }],
      { timeout: timeoutMs },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`gemini_timeout: Gemini 请求超时或失败 (${message})`);
  }

  const text = result.response.text();
  let parsed: Partial<AiImageResult> & Record<string, unknown>;
  try {
    parsed = JSON.parse(stripMarkdownFence(text));
  } catch {
    throw new Error("ai_parse_error: Gemini returned invalid JSON");
  }

  return assertRequiredAiFields(normalizeAiResult(parsed));
}

export function assertRequiredAiFields(normalized: AiImageResult): AiImageResult {
  const missing = REQUIRED_FIELDS.filter((field) => !String(normalized[field] ?? "").trim());
  if (missing.length > 0) {
    throw new Error(`ai_parse_error: AI response missing required fields: ${missing.join(", ")}`);
  }
  return normalized;
}

export async function analyzeImageFromBuffer(
  buffer: Buffer,
  mimeType: string,
  opts?: { brand?: string; model?: string },
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<AiImageResult> {
  return callGeminiWithInlineData(buffer.toString("base64"), mimeType || "image/jpeg", opts, timeoutMs);
}

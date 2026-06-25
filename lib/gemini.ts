import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiImageResult } from "./types";
import { AI_PROMPT } from "./prompt";

const REQUIRED_FIELDS: (keyof AiImageResult)[] = [
  "image_description",
  "new_file_name",
  "alt_text",
  "caption",
  "product_type",
  "main_color",
  "scene",
];

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

function normalizeAiResult(raw: Partial<AiImageResult>): AiImageResult {
  const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
  const altText = String(raw.alt_text ?? "");
  return {
    image_description: String(raw.image_description ?? ""),
    new_file_name: String(raw.new_file_name ?? ""),
    alt_text: altText,
    caption: String(raw.caption ?? altText),
    tags,
    product_type: String(raw.product_type ?? ""),
    main_color: String(raw.main_color ?? "uncertain"),
    scene: String(raw.scene ?? "uncertain"),
    confidence_note: raw.confidence_note === "uncertain" ? "uncertain" : "certain",
  };
}

export async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(imageUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`);
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType };
}

export async function analyzeImage(imageUrl: string): Promise<AiImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  });

  const { data, mimeType } = await fetchImageAsBase64(imageUrl);
  const result = await model.generateContent([
    AI_PROMPT,
    { inlineData: { data, mimeType } },
  ]);

  const text = result.response.text();
  let parsed: Partial<AiImageResult>;
  try {
    parsed = JSON.parse(stripMarkdownFence(text));
  } catch {
    throw new Error("ai_parse_error: Gemini returned invalid JSON");
  }

  const normalized = normalizeAiResult(parsed);
  const missing = REQUIRED_FIELDS.filter((field) => !normalized[field]);
  if (missing.length === REQUIRED_FIELDS.length) {
    throw new Error("ai_parse_error: AI response missing required fields");
  }

  return normalized;
}

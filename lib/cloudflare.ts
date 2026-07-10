import type { AiImageResult } from "./types";
import { assertRequiredAiFields, normalizeAiResult, stripMarkdownFence } from "./gemini";
import { buildContextPrefix } from "./prompt";

type CloudflareRunResponse = {
  success?: boolean;
  errors?: { message?: string }[];
  result?: {
    response?: string | Record<string, unknown>;
  };
  response?: string | Record<string, unknown>;
};

const CLOUDFLARE_FIELD_NAMES = [
  "image_description_en",
  "image_description_zh",
  "new_file_name",
  "alt_text_en",
  "alt_text_zh",
  "caption_en",
  "caption_zh",
  "tags_en",
  "tags_zh",
  "product_type_en",
  "product_type_zh",
  "main_color_en",
  "main_color_zh",
  "scene_en",
  "scene_zh",
  "confidence_note",
] as const;
const DEFAULT_REQUEST_TIMEOUT_MS = 25_000;

const CLOUDFLARE_LINE_PROMPT = `Analyze the uploaded image for ecommerce SEO metadata.
Return exactly 16 lines using FIELD|||VALUE. Do not return JSON, markdown, bullets, or explanations.
Use these fields in this exact order:
${CLOUDFLARE_FIELD_NAMES.join("\n")}
Use concise English for _en and matching Simplified Chinese for _zh.
For tags_en and tags_zh, separate up to 8 tags with |.
new_file_name must be lowercase English with hyphens and no extension.
confidence_note must be certain or uncertain.
Describe only visible content and never invent brands, materials, models, features, or scenes.`;

function readEnv(key: string): string {
  const raw = process.env[key] ?? "";
  return (raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw).trim();
}

function getCloudflareConfig() {
  const accountId = readEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = readEnv("CLOUDFLARE_API_TOKEN");
  const model = readEnv("CLOUDFLARE_MODEL") || "@cf/meta/llama-3.2-11b-vision-instruct";

  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is not configured");
  }
  if (!apiToken) {
    throw new Error("CLOUDFLARE_API_TOKEN is not configured");
  }

  return { accountId, apiToken, model };
}

function getResponsePayload(json: CloudflareRunResponse): string {
  if (typeof json.result?.response === "string") {
    return json.result.response;
  }
  if (json.result?.response && typeof json.result.response === "object") {
    return JSON.stringify(json.result.response);
  }
  if (typeof json.response === "string") {
    return json.response;
  }
  if (json.response && typeof json.response === "object") {
    return JSON.stringify(json.response);
  }
  return "";
}

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf("{");
  if (start < 0) {
    return text;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return text;
}

export function repairCloudflareJsonText(text: string): string {
  const candidate = extractFirstJsonObject(stripMarkdownFence(text));
  let repaired = "";
  let inString = false;
  let escaped = false;

  for (const ch of candidate) {
    if (inString) {
      if (escaped) {
        escaped = false;
        repaired += ch;
      } else if (ch === "\\") {
        escaped = true;
        repaired += ch;
      } else if (ch === "\"") {
        inString = false;
        repaired += ch;
      } else if (ch === "\n") {
        repaired += "\\n";
      } else if (ch !== "\r" && ch.charCodeAt(0) >= 0x20) {
        repaired += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
    }
    repaired += ch;
  }

  return repaired.replace(/,\s*([}\]])/g, "$1");
}

function parseAiPayload(json: CloudflareRunResponse): AiImageResult | null {
  const text = getResponsePayload(json);
  if (!text) {
    return null;
  }

  const candidates = [
    extractFirstJsonObject(stripMarkdownFence(text)),
    repairCloudflareJsonText(text),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<AiImageResult> & Record<string, unknown>;
      return assertRequiredAiFields(normalizeAiResult(parsed));
    } catch (error) {
      // Retry next candidate for parse errors; rethrow missing-required-field failures.
      if (error instanceof Error && error.message.startsWith("ai_parse_error: AI response missing")) {
        throw error;
      }
    }
  }

  return parseCloudflareLinePayload(text);
}

function cleanLineValue(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"],?$/g, "")
    .replace(/,$/, "")
    .trim();
}

function parseLineTags(value: string): string[] {
  const cleaned = cleanLineValue(value);
  if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
    try {
      const parsed = JSON.parse(repairCloudflareJsonText(cleaned));
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((tag) => tag.trim()).filter(Boolean);
      }
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  return cleaned
    .replace(/^\[|\]$/g, "")
    .split(/[|,\uFF0C\u3001]/)
    .map((tag) => cleanLineValue(tag).replace(/[.;\u3002\uFF1B]+$/g, ""))
    .filter(Boolean);
}

function cleanFileName(value: string): string {
  return cleanLineValue(value)
    .toLowerCase()
    .replace(/\.(?:jpe?g|png|webp|gif|avif|heic|heif)\.?$/i, "")
    .match(/[a-z0-9]+/g)
    ?.slice(0, 12)
    .join("-") ?? "image";
}

export function parseCloudflareLinePayload(text: string): AiImageResult | null {
  const raw: Record<string, unknown> = {};
  const allowedFields = new Set<string>(CLOUDFLARE_FIELD_NAMES);

  for (const line of stripMarkdownFence(text).split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:[-*]\s*)?["']?([a-z_]+)["']?\s*(?:\|\|\||:|=)\s*(.*?)\s*$/,
    );
    if (!match || !allowedFields.has(match[1])) {
      continue;
    }

    const [, field, value] = match;
    if (field === "tags_en" || field === "tags_zh") {
      raw[field] = parseLineTags(value);
    } else if (field === "new_file_name") {
      raw[field] = cleanFileName(value);
    } else if (field === "confidence_note") {
      raw[field] = cleanLineValue(value).toLowerCase().startsWith("uncertain")
        ? "uncertain"
        : "certain";
    } else {
      raw[field] = cleanLineValue(value);
    }
  }

  const usefulFieldCount = CLOUDFLARE_FIELD_NAMES.filter((field) => {
    const value = raw[field];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }).length;
  if (usefulFieldCount < 6 || (!raw.alt_text_en && !raw.image_description_en)) {
    return null;
  }

  return assertRequiredAiFields(normalizeAiResult(raw));
}

async function runCloudflareModel(
  buffer: Buffer,
  attempt: number,
  opts?: { brand?: string; model?: string },
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<CloudflareRunResponse> {
  const { accountId, apiToken, model } = getCloudflareConfig();
  const retryInstruction = attempt === 0
    ? ""
    : "\nThe previous response could not be parsed. Follow the FIELD|||VALUE line format exactly.";
  const contextPrefix = buildContextPrefix(opts);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        prompt: `${contextPrefix}${CLOUDFLARE_LINE_PROMPT}${retryInstruction}`,
        image: buffer.toString("base64"),
        max_tokens: 1200,
        temperature: 0,
        seed: attempt + 1,
      }),
    },
  );

  const rawText = await response.text();
  let json: CloudflareRunResponse | null = null;
  try {
    json = rawText ? (JSON.parse(rawText) as CloudflareRunResponse) : null;
  } catch {
    // Some API failures may return a plain-text body.
  }

  if (!response.ok) {
    const errorText = json?.errors?.map((item) => item.message).filter(Boolean).join("; ") || rawText;
    if (errorText.toLowerCase().includes("agree")) {
      throw new Error(
        `Cloudflare model requires license acceptance. Run "npm run cf:agree" first for ${model}.`,
      );
    }
    throw new Error(`Cloudflare API error ${response.status}: ${errorText || "empty response"}`);
  }

  if (!json) {
    throw new Error("ai_parse_error: Cloudflare returned invalid JSON envelope");
  }

  return json;
}

export async function analyzeImageFromBuffer(
  buffer: Buffer,
  _mimeType: string,
  opts?: { brand?: string; model?: string },
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<AiImageResult> {
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        throw new DOMException("Cloudflare request timed out", "TimeoutError");
      }
      const json = await runCloudflareModel(buffer, attempt, opts, remainingMs);
      const parsed = parseAiPayload(json);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const retryableJsonModeError = message.toLowerCase().includes("json mode couldn't be met");
      const retryableTimeout = error instanceof Error
        && (error.name === "AbortError" || error.name === "TimeoutError");
      if (attempt === 0 && (retryableJsonModeError || retryableTimeout)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("ai_parse_error: Cloudflare returned unparseable metadata after retry");
}

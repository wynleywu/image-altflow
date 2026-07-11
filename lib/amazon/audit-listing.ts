import { stripMarkdownFence } from "@/lib/gemini";
import type { AiImageResult } from "@/lib/types";
import { buildListingAuditPrompt } from "./listing-audit-prompt";
import { normalizeAuditResult } from "./normalize-audit";
import type { AmazonListingSnapshot, ListingAuditResult } from "./types";
import { callTextLlm } from "./text-llm";

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractOutermostJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function extractBalancedJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

async function repairAuditJson(rawText: string): Promise<Record<string, unknown> | null> {
  const repairPrompt = `You repair malformed JSON for an Amazon listing audit pipeline.
Return ONE valid JSON object only. No markdown. No commentary.
Preserve the original structure and wording as much as possible.
If a field is incomplete or missing, use an empty string, empty array, empty object, or 0 instead of inventing facts.

Malformed JSON:
${rawText.slice(0, 12000)}`;

  const repairedText = await callTextLlm(repairPrompt);
  const cleaned = stripMarkdownFence(repairedText);
  return (
    tryParseJson(cleaned)
    ?? (extractBalancedJson(cleaned) ? tryParseJson(extractBalancedJson(cleaned) as string) : null)
    ?? (extractOutermostJson(cleaned) ? tryParseJson(extractOutermostJson(cleaned) as string) : null)
  );
}

export async function auditListing(
  snapshot: AmazonListingSnapshot,
  imageContext?: AiImageResult,
): Promise<ListingAuditResult> {
  let prompt = buildListingAuditPrompt(snapshot);
  if (imageContext) {
    prompt += `\n\n## Optional image analysis context (verify listing claims against visible product)\n${JSON.stringify(
      {
        product_type_en: imageContext.product_type_en,
        main_color_en: imageContext.main_color_en,
        scene_en: imageContext.scene_en,
        alt_text_en: imageContext.alt_text_en,
        brand: imageContext.brand,
        model: imageContext.model,
      },
      null,
      2,
    )}`;
  }

  const text = await callTextLlm(prompt);
  const cleaned = stripMarkdownFence(text);
  const parsed =
    tryParseJson(cleaned)
    ?? (extractBalancedJson(cleaned) ? tryParseJson(extractBalancedJson(cleaned) as string) : null)
    ?? (extractOutermostJson(cleaned) ? tryParseJson(extractOutermostJson(cleaned) as string) : null)
    ?? await repairAuditJson(cleaned);

  if (!parsed) {
    console.error("[audit] raw LLM output:", text.slice(0, 1200));
    throw new Error("ai_parse_error: audit returned invalid JSON");
  }

  return normalizeAuditResult(parsed, snapshot);
}

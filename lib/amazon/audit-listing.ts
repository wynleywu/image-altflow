import { stripMarkdownFence } from "@/lib/gemini";
import type { AiImageResult } from "@/lib/types";
import { buildListingAuditPrompt } from "./listing-audit-prompt";
import { normalizeAuditResult } from "./normalize-audit";
import type { AmazonListingSnapshot, ListingAuditResult } from "./types";
import { callTextLlm } from "./text-llm";

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
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: extract outermost {...} from the response
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        console.error("[audit] raw LLM output:", text.slice(0, 500));
        throw new Error("ai_parse_error: audit returned invalid JSON");
      }
    } else {
      console.error("[audit] raw LLM output:", text.slice(0, 500));
      throw new Error("ai_parse_error: audit returned invalid JSON");
    }
  }

  return normalizeAuditResult(parsed, snapshot);
}

const BASE_PROMPT = `You are an ecommerce image SEO assistant.
Analyze the uploaded image and return one valid JSON object.
Provide English (_en) and Simplified Chinese (_zh) values with matching meaning.
Describe only visible content. Never invent brands, materials, models, features, or scenes.
new_file_name must be lowercase English, use hyphens, have no extension, and use at most 12 words.
tags_en and tags_zh must be arrays. confidence_note must be "certain" or "uncertain".
Return these fields:
image_description_en, image_description_zh,
new_file_name,
alt_text_en, alt_text_zh,
caption_en, caption_zh,
tags_en, tags_zh,
product_type_en, product_type_zh,
main_color_en, main_color_zh,
scene_en, scene_zh,
confidence_note.
Return JSON only, with no markdown or explanation.`;

export function buildContextPrefix(opts?: { brand?: string; model?: string }): string {
  const lines: string[] = [];
  if (opts?.brand) lines.push(`Brand: ${opts.brand}`);
  if (opts?.model) lines.push(`Model: ${opts.model}`);
  return lines.length
    ? `Known product info (use these exactly in your output — do not guess or modify):\n${lines.join("\n")}\n\n`
    : "";
}

export function buildPrompt(opts?: { brand?: string; model?: string }): string {
  const prefix = buildContextPrefix(opts);
  return prefix ? prefix + BASE_PROMPT : BASE_PROMPT;
}

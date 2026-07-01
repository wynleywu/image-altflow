const MODELSCOPE_BASE_URL = "https://api-inference.modelscope.cn/v1";
const TEXT_MODEL_FALLBACK = "Qwen/Qwen3-32B";

export function readAmazonEnv(key: string): string {
  const raw = process.env[key] ?? "";
  return (raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw).trim();
}

export type AmazonTextProvider = "gemini" | "modelscope";

export function getAmazonTextProvider(): AmazonTextProvider {
  const pref = readAmazonEnv("AMAZON_TEXT_PROVIDER").toLowerCase();
  if (pref === "modelscope" && readAmazonEnv("MODELSCOPE_API_KEY")) return "modelscope";
  if (pref === "gemini" && readAmazonEnv("GEMINI_API_KEY")) return "gemini";
  if (readAmazonEnv("GEMINI_API_KEY")) return "gemini";
  return "modelscope";
}

async function callModelScopeText(prompt: string): Promise<string> {
  const apiKey = readAmazonEnv("MODELSCOPE_API_KEY");
  if (!apiKey) {
    throw new Error("MODELSCOPE_API_KEY is not configured");
  }

  const configured = readAmazonEnv("MODELSCOPE_TEXT_MODEL") || readAmazonEnv("MODELSCOPE_MODEL");
  const model = configured && !configured.toLowerCase().includes("vl") ? configured : TEXT_MODEL_FALLBACK;

  const response = await fetch(`${MODELSCOPE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      temperature: 0.2,
      // Qwen3 defaults to thinking mode; disable it for JSON-only tasks
      enable_thinking: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ModelScope text API error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new Error("ai_parse_error: empty response");
  }
  return text;
}

async function callGeminiText(prompt: string): Promise<string> {
  const apiKey = readAmazonEnv("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const modelName = readAmazonEnv("GEMINI_MODEL") || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini text API error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    throw new Error("ai_parse_error: empty Gemini response");
  }
  return text;
}

/** Amazon Listing 文本任务：默认 Gemini，可由 AMAZON_TEXT_PROVIDER 切换。 */
export async function callTextLlm(prompt: string): Promise<string> {
  const primary = getAmazonTextProvider();

  if (primary === "gemini") {
    try {
      return await callGeminiText(prompt);
    } catch (err) {
      if (readAmazonEnv("MODELSCOPE_API_KEY")) {
        console.warn("[text-llm] Gemini failed, fallback ModelScope:", err instanceof Error ? err.message : err);
        return callModelScopeText(prompt);
      }
      throw err;
    }
  }

  try {
    return await callModelScopeText(prompt);
  } catch (err) {
    if (readAmazonEnv("GEMINI_API_KEY")) {
      console.warn("[text-llm] ModelScope failed, fallback Gemini:", err instanceof Error ? err.message : err);
      return callGeminiText(prompt);
    }
    throw err;
  }
}

export function hasTextLlmProvider(): boolean {
  return Boolean(readAmazonEnv("GEMINI_API_KEY") || readAmazonEnv("MODELSCOPE_API_KEY"));
}

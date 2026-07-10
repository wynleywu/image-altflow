import assert from "node:assert/strict";
import test from "node:test";
import { analyzeImageFromBuffer as analyzeWithModelScope } from "./modelscope";
import { callTextLlm } from "./amazon/text-llm";

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

test("ModelScope image requests carry an abort signal", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.MODELSCOPE_API_KEY;
  let signalSeen = false;
  try {
    process.env.MODELSCOPE_API_KEY = "test-key";
    globalThis.fetch = (async (_input, init) => {
      signalSeen = init?.signal instanceof AbortSignal;
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              image_description_en: "A lamp",
              new_file_name: "lamp",
              alt_text_en: "A lamp",
              caption_en: "Desk lamp",
            }),
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const result = await analyzeWithModelScope(Buffer.from("image"), "image/jpeg", undefined, 1_000);
    assert.equal(result.new_file_name, "lamp");
    assert.equal(signalSeen, true);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MODELSCOPE_API_KEY", previousKey);
  }
});

test("Amazon text requests fall back after a timed-out primary provider", async () => {
  const originalFetch = globalThis.fetch;
  const previousProvider = process.env.AMAZON_TEXT_PROVIDER;
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousModelScopeKey = process.env.MODELSCOPE_API_KEY;
  const originalWarn = console.warn;
  const signals: boolean[] = [];
  let calls = 0;
  try {
    process.env.AMAZON_TEXT_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gemini-test";
    process.env.MODELSCOPE_API_KEY = "modelscope-test";
    console.warn = () => {};
    globalThis.fetch = (async (_input, init) => {
      calls += 1;
      signals.push(init?.signal instanceof AbortSignal);
      if (calls === 1) {
        const timeout = new Error("timed out");
        timeout.name = "TimeoutError";
        throw timeout;
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "fallback-ok" } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    assert.equal(await callTextLlm("test"), "fallback-ok");
    assert.equal(calls, 2);
    assert.deepEqual(signals, [true, true]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("AMAZON_TEXT_PROVIDER", previousProvider);
    restoreEnv("GEMINI_API_KEY", previousGeminiKey);
    restoreEnv("MODELSCOPE_API_KEY", previousModelScopeKey);
    console.warn = originalWarn;
  }
});

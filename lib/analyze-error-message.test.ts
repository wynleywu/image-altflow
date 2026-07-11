import assert from "node:assert/strict";
import test from "node:test";
import { formatAnalyzeErrorMessage, formatEmbedErrorMessage } from "./analyze-error-message";

test("formatAnalyzeErrorMessage maps all-provider failures to readable Chinese", () => {
  const raw =
    "All AI providers failed. modelscope: The operation was aborted due to timeout | gemini: gemini_timeout: Gemini 请求超时或失败 ([GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent: [503 Service Unavailable] This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.)";
  const message = formatAnalyzeErrorMessage(raw, "analyze_failed");
  assert.match(message, /识图服务暂时不可用/);
  assert.match(message, /ModelScope 响应超时/);
  assert.match(message, /Gemini 当前访问量较高/);
  assert.doesNotMatch(message, /GoogleGenerativeAI/);
});

test("formatAnalyzeErrorMessage handles missing provider config", () => {
  const message = formatAnalyzeErrorMessage("No AI provider available. Please configure MODELSCOPE_API_KEY, CLOUDFLARE credentials, or GEMINI_API_KEY.");
  assert.match(message, /未配置可用的 AI 服务/);
});

test("formatEmbedErrorMessage maps embed_unavailable", () => {
  const message = formatEmbedErrorMessage("embed_unavailable: ExifTool unavailable and no JS fallback for mimeType=image/webp", "embed_unavailable");
  assert.match(message, /无法写入该格式的图片元数据/);
  assert.match(message, /JPEG 或 PNG/);
});

test("formatAnalyzeErrorMessage maps rate_limited", () => {
  assert.equal(
    formatAnalyzeErrorMessage("请求过于频繁，请稍后再试", "rate_limited"),
    "请求过于频繁，请稍后再试",
  );
});

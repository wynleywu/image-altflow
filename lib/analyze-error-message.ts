const PROVIDER_LABELS: Record<string, string> = {
  modelscope: "ModelScope",
  gemini: "Gemini",
  cloudflare: "Cloudflare",
};

function summarizeProviderDetail(provider: string, detail: string): string {
  const label = PROVIDER_LABELS[provider] ?? provider;
  const lower = detail.toLowerCase();

  if (lower.includes("503") || lower.includes("high demand") || lower.includes("service unavailable")) {
    return `${label} 当前访问量较高`;
  }
  if (lower.includes("timeout") || lower.includes("aborted") || lower.includes("timed out")) {
    return `${label} 响应超时`;
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
    return `${label} 请求过于频繁或额度不足`;
  }
  if (
    lower.includes("401")
    || lower.includes("403")
    || lower.includes("api key")
    || lower.includes("not configured")
    || lower.includes("unauthorized")
  ) {
    return `${label} API 密钥无效或未配置`;
  }
  if (lower.includes("ai_parse_error") || lower.includes("invalid json") || lower.includes("empty content")) {
    return `${label} 返回结果无法解析`;
  }
  return `${label} 请求失败`;
}

function formatAllProvidersFailed(message: string): string {
  const body = message.replace(/^All AI providers failed\.\s*/i, "");
  const parts = body.split(" | ").filter(Boolean);
  const summaries = parts.map((part) => {
    const colon = part.indexOf(": ");
    if (colon === -1) return part;
    const provider = part.slice(0, colon).trim().toLowerCase();
    const detail = part.slice(colon + 2);
    return summarizeProviderDetail(provider, detail);
  });
  const reason = [...new Set(summaries)].join("；");
  return `识图服务暂时不可用（${reason}）。请稍后点击「重新分析」，或在 .env.local 中检查 AI 配置后重启 dev server。`;
}

export function formatAnalyzeErrorMessage(raw?: string, errorType?: string): string {
  const message = (raw ?? "").trim();

  if (errorType === "rate_limited") {
    return message || "请求过于频繁，请稍后再试";
  }
  if (errorType === "file_too_large" || message.includes("超过 5 MB")) {
    return message || "图片超过 5 MB，请压缩后重试";
  }
  if (errorType === "missing_image") {
    return "请上传图片文件";
  }
  if (errorType === "invalid_request") {
    return "请求格式不正确，请刷新页面后重试";
  }
  if (errorType === "ai_parse_error" || message.startsWith("ai_parse_error")) {
    return "AI 返回的结果格式异常，请稍后重试";
  }
  if (message.includes("No AI provider available")) {
    return "未配置可用的 AI 服务。请在 .env.local 中设置 MODELSCOPE_API_KEY、Cloudflare 凭据或 GEMINI_API_KEY，然后重启 dev server。";
  }
  if (message.includes("All AI providers failed")) {
    return formatAllProvidersFailed(message);
  }
  if (errorType === "gemini_timeout" || message.startsWith("gemini_timeout")) {
    const lower = message.toLowerCase();
    if (lower.includes("503") || lower.includes("high demand") || lower.includes("service unavailable")) {
      return "Gemini 当前访问量较高，通常为暂时现象。请稍后点击「重新分析」。";
    }
    return "Gemini 响应超时或暂时不可用，请稍后重试。";
  }
  if (message.includes("MODELSCOPE_API_KEY")) {
    return "未配置 MODELSCOPE_API_KEY，请在 .env.local 中设置后重启 dev server";
  }
  if (message.includes("GEMINI_API_KEY")) {
    return "未配置 GEMINI_API_KEY，请在 .env.local 中设置后重启 dev server";
  }
  if (message.includes("CLOUDFLARE")) {
    return "未配置 Cloudflare Workers AI 凭据，请在 .env.local 中设置 CLOUDFLARE_ACCOUNT_ID 与 CLOUDFLARE_API_TOKEN";
  }
  if (message.includes("ModelScope API error")) {
    return "ModelScope 识图失败，请稍后重试或检查 API Key 与模型配置";
  }

  return message || "识图失败，请稍后重试";
}

export function formatEmbedErrorMessage(raw?: string, errorType?: string): string {
  const message = (raw ?? "").trim();

  if (errorType === "rate_limited") {
    return message || "请求过于频繁，请稍后再试";
  }
  if (errorType === "file_too_large" || message.includes("超过 5 MB")) {
    return message || "图片超过 5 MB，请压缩后重试";
  }
  if (errorType === "invalid_request") {
    return "写入请求不完整，请刷新页面后重试";
  }
  if (errorType === "invalid_ai_json") {
    return "元数据格式异常，请重新识图后再写入";
  }
  if (errorType === "embed_unavailable" || message.startsWith("embed_unavailable")) {
    return "当前环境无法写入图片元数据（ExifTool 不可用）。请使用 JPEG 格式，或在本地安装 ExifTool 后重试";
  }
  if (message.includes("request_too_large")) {
    return "请求体积过大，请压缩图片后重试";
  }

  return message || "写入元数据失败，请稍后重试";
}

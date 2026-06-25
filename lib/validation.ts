import type { AnalyzeRequest } from "./types";

export function parseFileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    return last || "unknown.jpg";
  } catch {
    return "unknown.jpg";
  }
}

export function createTraceId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 10);
  return `img-${date}-${rand}`;
}

export function validateAnalyzeInput(body: Partial<AnalyzeRequest>): {
  ok: true;
  data: Required<Pick<AnalyzeRequest, "image_url">> &
    Pick<AnalyzeRequest, "original_file_name" | "source" | "trace_id">;
} | {
  ok: false;
  error_type: string;
  error: string;
} {
  const imageUrl = String(body.image_url ?? "").trim();
  if (!imageUrl) {
    return { ok: false, error_type: "missing_image_url", error: "image_url is required" };
  }
  if (!/^https?:\/\//i.test(imageUrl)) {
    return { ok: false, error_type: "invalid_image_url", error: "image_url must start with http or https" };
  }

  return {
    ok: true,
    data: {
      image_url: imageUrl,
      original_file_name: body.original_file_name?.trim() || parseFileNameFromUrl(imageUrl),
      source: body.source?.trim() || "web",
      trace_id: body.trace_id?.trim() || createTraceId(),
    },
  };
}

import type { AiImageResult, FlowStatus, ImageRecord, ReviewStatus } from "./types";

type FeishuFieldValue = string | number | string[] | { link: string; text?: string };

interface FeishuRecordItem {
  record_id: string;
  fields: Record<string, FeishuFieldValue>;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

async function getTenantAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: requireEnv("FEISHU_APP_ID"),
      app_secret: requireEnv("FEISHU_APP_SECRET"),
    }),
  });

  const data = await response.json();
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(data.msg || "Failed to get Feishu tenant access token");
  }

  cachedToken = {
    value: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire ?? 7200) * 1000,
  };
  return cachedToken.value;
}

function bitableBaseUrl(): string {
  const appToken = requireEnv("FEISHU_BITABLE_APP_TOKEN");
  const tableId = requireEnv("FEISHU_BITABLE_TABLE_ID");
  return `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}`;
}

async function feishuRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getTenantAccessToken();
  const response = await fetch(`${bitableBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(data.msg || `Feishu API error (${data.code})`);
  }
  return data.data as T;
}

function readText(fields: Record<string, FeishuFieldValue>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value : "";
}

function readTags(fields: Record<string, FeishuFieldValue>, key: string): string[] {
  const value = fields[key];
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function readUrl(fields: Record<string, FeishuFieldValue>, key: string): string {
  const value = fields[key];
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "link" in value) {
    return String(value.link ?? "");
  }
  return "";
}

function mapRecord(item: FeishuRecordItem): ImageRecord {
  const fields = item.fields;
  const manualNote = readText(fields, "人工备注");
  const traceFromNote = manualNote.match(/\[trace:([^\]]+)\]/)?.[1] ?? "";
  return {
    recordId: item.record_id,
    traceId: readText(fields, "Trace ID") || traceFromNote,
    imageUrl: readUrl(fields, "图片链接"),
    originalFileName: readText(fields, "原文件名"),
    source: "feishu",
    imageDescription: readText(fields, "AI识别描述"),
    newFileName: readText(fields, "新文件名"),
    altText: readText(fields, "Alt Text"),
    caption: readText(fields, "Caption"),
    tags: readTags(fields, "Tags"),
    productType: readText(fields, "产品类型"),
    mainColor: readText(fields, "主体颜色"),
    scene: readText(fields, "使用场景"),
    confidenceNote: "",
    flowStatus: (readText(fields, "流程状态") as FlowStatus) || (readText(fields, "AI识别描述") ? "success" : "failed"),
    reviewStatus: (readText(fields, "审核状态") as ReviewStatus | "") || "",
    errorType: readText(fields, "异常类型"),
    errorMessage: readText(fields, "异常说明"),
    manualNote,
    createdAt: typeof fields["创建时间"] === "number" ? fields["创建时间"] : null,
  };
}

function buildFields(input: {
  traceId: string;
  imageUrl: string;
  originalFileName: string;
  ai?: AiImageResult;
  flowStatus: FlowStatus;
  reviewStatus?: ReviewStatus | "";
  errorType?: string;
  errorMessage?: string;
}): Record<string, FeishuFieldValue> {
  const fields: Record<string, FeishuFieldValue> = {
    原文件名: input.originalFileName,
    图片链接: { link: input.imageUrl, text: "preview" },
    审核状态: input.reviewStatus ?? "",
  };

  if (input.ai) {
    fields["AI识别描述"] = input.ai.image_description;
    fields["新文件名"] = input.ai.new_file_name;
    fields["Alt Text"] = input.ai.alt_text;
    fields.Caption = input.ai.caption;
    fields.Tags = input.ai.tags;
    fields["产品类型"] = input.ai.product_type;
    fields["主体颜色"] = input.ai.main_color;
    fields["使用场景"] = input.ai.scene;
  }

  const notes: string[] = [`[trace:${input.traceId}]`];
  if (input.errorType || input.errorMessage) {
    notes.push(`[error:${input.errorType || "unknown"}] ${input.errorMessage || ""}`.trim());
  }
  fields["人工备注"] = notes.join(" ");

  return fields;
}

export async function createImageRecord(input: {
  traceId: string;
  imageUrl: string;
  originalFileName: string;
  ai?: AiImageResult;
  flowStatus: FlowStatus;
  reviewStatus?: ReviewStatus | "";
  errorType?: string;
  errorMessage?: string;
}): Promise<ImageRecord> {
  const data = await feishuRequest<{ record: FeishuRecordItem }>("/records", {
    method: "POST",
    body: JSON.stringify({ fields: buildFields(input) }),
  });
  return mapRecord(data.record);
}

export async function listImageRecords(reviewStatus?: string): Promise<ImageRecord[]> {
  const params = new URLSearchParams({ page_size: "100" });
  const data = await feishuRequest<{ items?: FeishuRecordItem[] }>(`/records?${params.toString()}`);
  const items = data.items ?? [];
  const records = items.map(mapRecord);
  if (!reviewStatus) {
    return records.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }
  return records
    .filter((record) => record.reviewStatus === reviewStatus)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function updateImageRecord(
  recordId: string,
  patch: {
    newFileName?: string;
    altText?: string;
    caption?: string;
    reviewStatus?: ReviewStatus;
    manualNote?: string;
  },
): Promise<ImageRecord> {
  const fields: Record<string, FeishuFieldValue> = {};
  if (patch.newFileName !== undefined) fields["新文件名"] = patch.newFileName;
  if (patch.altText !== undefined) fields["Alt Text"] = patch.altText;
  if (patch.caption !== undefined) fields.Caption = patch.caption;
  if (patch.reviewStatus !== undefined) fields["审核状态"] = patch.reviewStatus;
  if (patch.manualNote !== undefined) fields["人工备注"] = patch.manualNote;

  const data = await feishuRequest<{ record: FeishuRecordItem }>(`/records/${recordId}`, {
    method: "PUT",
    body: JSON.stringify({ fields }),
  });
  return mapRecord(data.record);
}

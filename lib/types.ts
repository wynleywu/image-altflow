export type ReviewStatus = "待审核" | "通过" | "退回";

export type FlowStatus = "pending" | "running" | "success" | "failed";

export interface AiImageResult {
  image_description_en: string;
  image_description_zh: string;
  new_file_name: string;
  alt_text_en: string;
  alt_text_zh: string;
  caption_en: string;
  caption_zh: string;
  tags_en: string[];
  tags_zh: string[];
  product_type_en: string;
  product_type_zh: string;
  main_color_en: string;
  main_color_zh: string;
  scene_en: string;
  scene_zh: string;
  confidence_note: "certain" | "uncertain";
  brand?: string;
  model?: string;
}

export interface ImageRecord {
  recordId: string;
  traceId: string;
  imageUrl: string;
  sourceImageUrl: string;
  thumbnailDataUrl: string;
  originalFileName: string;
  source: string;
  imageDescription: string;
  newFileName: string;
  altText: string;
  caption: string;
  tags: string[];
  productType: string;
  mainColor: string;
  scene: string;
  confidenceNote: string;
  flowStatus: FlowStatus;
  reviewStatus: ReviewStatus | "";
  errorType: string;
  errorMessage: string;
  manualNote: string;
  createdAt: number | null;
}

export interface AnalyzeRequest {
  image_url: string;
  original_file_name?: string;
  source?: string;
  trace_id?: string;
}

export interface AnalyzeApiResponse {
  ok: boolean;
  ai?: AiImageResult;
  originalImageBase64?: string;
  mimeType?: string;
  originalFileName?: string;
  record?: ImageRecord;
  error?: string;
  error_type?: string;
}

export interface EmbedRequest {
  imageBase64: string;
  mimeType: string;
  ai: AiImageResult;
  traceId?: string;
  originalFileName?: string;
}

export interface EmbedDownloadPayload {
  fileName: string;
  mimeType: string;
  base64: string;
}

export interface EmbedApiResponse {
  ok: boolean;
  download?: EmbedDownloadPayload;
  record?: ImageRecord;
  error?: string;
  error_type?: string;
}

/** @deprecated Use AnalyzeApiResponse */
export interface AnalyzeResponse {
  ok: boolean;
  record?: ImageRecord;
  error?: string;
  error_type?: string;
}

export interface PipelineAnalyzeResult {
  ai: AiImageResult;
  buffer: Buffer;
  mimeType: string;
  originalFileName: string;
}

export interface PipelineEmbedResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

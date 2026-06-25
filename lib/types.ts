export type ReviewStatus = "待审核" | "通过" | "退回";

export type FlowStatus = "pending" | "running" | "success" | "failed";

export interface AiImageResult {
  image_description: string;
  new_file_name: string;
  alt_text: string;
  caption: string;
  tags: string[];
  product_type: string;
  main_color: string;
  scene: string;
  confidence_note: "certain" | "uncertain";
}

export interface ImageRecord {
  recordId: string;
  traceId: string;
  imageUrl: string;
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

export interface AnalyzeResponse {
  ok: boolean;
  record?: ImageRecord;
  error?: string;
  error_type?: string;
}

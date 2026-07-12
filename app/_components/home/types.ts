import type { AiImageResult, EmbedApiResponse } from "@/lib/types";

export type Step = "upload" | "confirm" | "analyzing" | "edit" | "done";

export type Mode = "idle" | "single" | "batch";

export const BATCH_MAX_FILES = 20;
export const BATCH_CONCURRENCY = 1;

export type BatchStatus = "queued" | "analyzing" | "embedding" | "done" | "error";

export interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  status: BatchStatus;
  ai?: AiImageResult;
  download?: EmbedApiResponse["download"];
  errorMessage?: string;
}

export type DoneThumb = {
  id: string;
  imageUrl: string;
  fileName: string;
  onClick: () => void;
};

"use server";

import { listImageRecords, updateImageRecord } from "@/lib/records";
import type { ImageRecord, ReviewStatus } from "@/lib/types";

export async function loadReviewRecords(reviewStatus?: string): Promise<{
  ok: boolean;
  records?: ImageRecord[];
  error?: string;
}> {
  try {
    if (!process.env.POSTGRES_URL) {
      return { ok: false, error: "POSTGRES_URL is not configured" };
    }
    const records = await listImageRecords(reviewStatus || undefined);
    return { ok: true, records };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to list records",
    };
  }
}

export async function saveReviewRecord(input: {
  recordId: string;
  newFileName: string;
  altText: string;
  caption: string;
  reviewStatus: ReviewStatus | "";
}): Promise<{ ok: boolean; record?: ImageRecord; error?: string }> {
  try {
    if (!process.env.POSTGRES_URL) {
      return { ok: false, error: "POSTGRES_URL is not configured" };
    }
    const record = await updateImageRecord(input.recordId, {
      newFileName: input.newFileName,
      altText: input.altText,
      caption: input.caption,
      reviewStatus: input.reviewStatus || undefined,
    });
    return { ok: true, record };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update record",
    };
  }
}

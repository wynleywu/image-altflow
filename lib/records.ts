import { ensureSchema, getSql } from "@/lib/db";
import type { AiImageResult, FlowStatus, ImageRecord, ReviewStatus } from "./types";

interface ImageRecordRow {
  id: string;
  trace_id: string;
  image_url: string;
  source_image_url: string;
  original_file_name: string;
  source: string;
  image_description: string;
  new_file_name: string;
  alt_text: string;
  caption: string;
  tags: string[] | string;
  product_type: string;
  main_color: string;
  scene: string;
  confidence_note: string;
  flow_status: string;
  review_status: string;
  error_type: string;
  error_message: string;
  manual_note: string;
  created_at: Date | string;
}

function parseTags(value: string[] | string): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapRow(row: ImageRecordRow): ImageRecord {
  const createdAt = row.created_at ? new Date(row.created_at).getTime() : null;
  return {
    recordId: row.id,
    traceId: row.trace_id,
    imageUrl: row.image_url,
    sourceImageUrl: row.source_image_url || "",
    originalFileName: row.original_file_name,
    source: row.source,
    imageDescription: row.image_description,
    newFileName: row.new_file_name,
    altText: row.alt_text,
    caption: row.caption,
    tags: parseTags(row.tags),
    productType: row.product_type,
    mainColor: row.main_color,
    scene: row.scene,
    confidenceNote: row.confidence_note,
    flowStatus: row.flow_status as FlowStatus,
    reviewStatus: row.review_status as ReviewStatus | "",
    errorType: row.error_type,
    errorMessage: row.error_message,
    manualNote: row.manual_note,
    createdAt: Number.isNaN(createdAt) ? null : createdAt,
  };
}

export async function createImageRecord(input: {
  traceId: string;
  imageUrl: string;
  sourceImageUrl?: string;
  originalFileName: string;
  source?: string;
  ai?: AiImageResult;
  flowStatus: FlowStatus;
  reviewStatus?: ReviewStatus | "";
  errorType?: string;
  errorMessage?: string;
}): Promise<ImageRecord> {
  await ensureSchema();
  const sql = getSql();

  const id = crypto.randomUUID();
  const tags = input.ai?.tags_en ?? [];
  const manualNote = input.ai
    ? JSON.stringify(input.ai)
    : input.errorType || input.errorMessage
      ? `[error:${input.errorType || "unknown"}] ${input.errorMessage || ""}`.trim()
      : "";

  const rows = (await sql`
    INSERT INTO image_records (
      id,
      trace_id,
      image_url,
      source_image_url,
      original_file_name,
      source,
      image_description,
      new_file_name,
      alt_text,
      caption,
      tags,
      product_type,
      main_color,
      scene,
      confidence_note,
      flow_status,
      review_status,
      error_type,
      error_message,
      manual_note
    ) VALUES (
      ${id},
      ${input.traceId},
      ${input.imageUrl},
      ${input.sourceImageUrl ?? ""},
      ${input.originalFileName},
      ${input.source ?? "web"},
      ${input.ai?.image_description_en ?? ""},
      ${input.ai?.new_file_name ?? ""},
      ${input.ai?.alt_text_en ?? ""},
      ${input.ai?.caption_en ?? ""},
      ${JSON.stringify(tags)},
      ${input.ai?.product_type_en ?? ""},
      ${input.ai?.main_color_en ?? ""},
      ${input.ai?.scene_en ?? ""},
      ${input.ai?.confidence_note ?? ""},
      ${input.flowStatus},
      ${input.reviewStatus ?? ""},
      ${input.errorType ?? ""},
      ${input.errorMessage ?? ""},
      ${manualNote}
    )
    RETURNING *
  `) as ImageRecordRow[];

  return mapRow(rows[0]);
}

export async function listImageRecords(reviewStatus?: string): Promise<ImageRecord[]> {
  await ensureSchema();
  const sql = getSql();

  const rows = (reviewStatus
    ? await sql`
        SELECT * FROM image_records
        WHERE review_status = ${reviewStatus}
        ORDER BY created_at DESC
        LIMIT 200
      `
    : await sql`
        SELECT * FROM image_records
        ORDER BY created_at DESC
        LIMIT 200
      `) as ImageRecordRow[];

  return rows.map(mapRow);
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
  await ensureSchema();
  const sql = getSql();

  const current = (await sql`
    SELECT * FROM image_records WHERE id = ${recordId} LIMIT 1
  `) as ImageRecordRow[];
  if (!current[0]) {
    throw new Error("Record not found");
  }

  const row = current[0];
  const rows = (await sql`
    UPDATE image_records
    SET
      new_file_name = ${patch.newFileName ?? row.new_file_name},
      alt_text = ${patch.altText ?? row.alt_text},
      caption = ${patch.caption ?? row.caption},
      review_status = ${patch.reviewStatus ?? row.review_status},
      manual_note = ${patch.manualNote ?? row.manual_note}
    WHERE id = ${recordId}
    RETURNING *
  `) as ImageRecordRow[];

  return mapRow(rows[0]);
}

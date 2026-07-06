import { neon } from "@neondatabase/serverless";

let schemaReady: Promise<void> | null = null;

function getSql() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("POSTGRES_URL is not configured");
  }
  return neon(url);
}

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS image_records (
          id TEXT PRIMARY KEY,
          trace_id TEXT NOT NULL,
          image_url TEXT NOT NULL DEFAULT '',
          source_image_url TEXT NOT NULL DEFAULT '',
          original_file_name TEXT NOT NULL DEFAULT 'unknown.jpg',
          source TEXT NOT NULL DEFAULT 'web',
          image_description TEXT NOT NULL DEFAULT '',
          new_file_name TEXT NOT NULL DEFAULT '',
          alt_text TEXT NOT NULL DEFAULT '',
          caption TEXT NOT NULL DEFAULT '',
          tags JSONB NOT NULL DEFAULT '[]'::jsonb,
          product_type TEXT NOT NULL DEFAULT '',
          main_color TEXT NOT NULL DEFAULT '',
          scene TEXT NOT NULL DEFAULT '',
          confidence_note TEXT NOT NULL DEFAULT '',
          flow_status TEXT NOT NULL DEFAULT 'pending',
          review_status TEXT NOT NULL DEFAULT '',
          error_type TEXT NOT NULL DEFAULT '',
          error_message TEXT NOT NULL DEFAULT '',
          manual_note TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_image_records_review_status ON image_records (review_status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_image_records_created_at ON image_records (created_at DESC)`;
      await sql`ALTER TABLE image_records ADD COLUMN IF NOT EXISTS source_image_url TEXT NOT NULL DEFAULT ''`;
    })();
  }
  await schemaReady;
}

export { getSql };

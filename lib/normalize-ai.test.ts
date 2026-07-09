import assert from "node:assert/strict";
import test from "node:test";
import { assertRequiredAiFields, normalizeAiResult } from "./gemini";
import { parseAiFromJson } from "./pipeline";
import { sanitizeDownloadFileName, mimeTypeFromFileName } from "./filename";
import { canPersistAll, canPersistBlob, canPersistRecords } from "./persist";
import { resolveMimeType } from "./embed-metadata";

test("normalizeAiResult preserves brand and model", () => {
  const result = normalizeAiResult({
    alt_text_en: "A lamp",
    caption_en: "Desk lamp",
    image_description_en: "Wooden desk lamp",
    new_file_name: "lamp.jpg",
    brand: " Acme ",
    model: " X1 ",
  });
  assert.equal(result.brand, "Acme");
  assert.equal(result.model, "X1");
});

test("normalizeAiResult drops empty brand/model", () => {
  const result = normalizeAiResult({
    alt_text_en: "A lamp",
    caption_en: "Desk lamp",
    image_description_en: "Wooden desk lamp",
    new_file_name: "lamp.jpg",
    brand: "   ",
    model: "",
  });
  assert.equal(result.brand, undefined);
  assert.equal(result.model, undefined);
});

test("parseAiFromJson keeps brand through normalize", () => {
  const result = parseAiFromJson({
    alt_text_en: "A lamp",
    caption_en: "Desk lamp",
    image_description_en: "Wooden desk lamp",
    new_file_name: "lamp.jpg",
    brand: "Acme",
  });
  assert.equal(result.brand, "Acme");
});

test("assertRequiredAiFields fails when any required field is empty", () => {
  assert.throws(
    () =>
      assertRequiredAiFields(
        normalizeAiResult({
          alt_text_en: "",
          caption_en: "c",
          image_description_en: "d",
          new_file_name: "n.jpg",
        }),
      ),
    /missing required fields: alt_text_en/,
  );
});

test("sanitizeDownloadFileName adds extension and strips unsafe chars", () => {
  assert.equal(sanitizeDownloadFileName("my lamp!!", "image/jpeg"), "my-lamp.jpg");
  assert.equal(sanitizeDownloadFileName("../evil.png", "image/png"), "evil.png");
  assert.equal(mimeTypeFromFileName("x.webp"), "image/webp");
  assert.equal(resolveMimeType("application/octet-stream", "x.png"), "image/png");
  assert.equal(resolveMimeType("image/jpeg", "x.png"), "image/jpeg");
});

test("persist switches require env vars", () => {
  const prevPg = process.env.POSTGRES_URL;
  const prevBlob = process.env.BLOB_READ_WRITE_TOKEN;
  try {
    delete process.env.POSTGRES_URL;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    assert.equal(canPersistRecords(), false);
    assert.equal(canPersistBlob(), false);
    assert.equal(canPersistAll(), false);

    process.env.POSTGRES_URL = "postgres://example";
    assert.equal(canPersistRecords(), true);
    assert.equal(canPersistAll(), false);

    process.env.BLOB_READ_WRITE_TOKEN = "token";
    assert.equal(canPersistAll(), true);
  } finally {
    if (prevPg === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = prevPg;
    if (prevBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = prevBlob;
  }
});

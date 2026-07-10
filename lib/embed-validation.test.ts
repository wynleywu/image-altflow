import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeImageBase64,
  EmbedValidationError,
  validateImageBuffer,
} from "./embed-validation";
import { injectJpegMetadata, injectPngMetadata } from "./embed-metadata-js";
import type { AiImageResult } from "./types";

function makeAi(altText = "A desk lamp"): AiImageResult {
  return {
    image_description_en: altText,
    image_description_zh: "",
    new_file_name: "desk-lamp",
    alt_text_en: altText,
    alt_text_zh: "",
    caption_en: altText,
    caption_zh: "",
    tags_en: ["lamp"],
    tags_zh: [],
    product_type_en: "lamp",
    product_type_zh: "",
    main_color_en: "black",
    main_color_zh: "",
    scene_en: "desk",
    scene_zh: "",
    confidence_note: "certain",
  };
}

test("strict base64 decoding accepts canonical image data and rejects garbage", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  assert.deepEqual(decodeImageBase64(jpeg.toString("base64")), jpeg);
  assert.throws(
    () => decodeImageBase64("not!base64"),
    (error: unknown) => error instanceof EmbedValidationError && error.errorType === "invalid_base64",
  );
});

test("image validation detects MIME mismatches", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  assert.equal(validateImageBuffer(jpeg, "image/jpg"), "image/jpeg");
  assert.throws(
    () => validateImageBuffer(jpeg, "image/png"),
    (error: unknown) => error instanceof EmbedValidationError && error.errorType === "mime_mismatch",
  );
});

test("JPEG fallback rejects non-JPEG input and oversized metadata segments", () => {
  assert.throws(() => injectJpegMetadata(Buffer.from("not-a-jpeg"), makeAi()), /Invalid JPEG/);
  assert.throws(
    () => injectJpegMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), makeAi("x".repeat(70_000))),
    /metadata segment exceeds 65535 bytes/,
  );
});

// 1x1 transparent PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("PNG fallback injects XMP iTXt and eXIf before IDAT", () => {
  assert.throws(() => injectPngMetadata(Buffer.from("not-a-png"), makeAi()), /Invalid PNG/);

  const out = injectPngMetadata(TINY_PNG, makeAi("Red pixel product shot"));
  assert.ok(out.subarray(0, 8).equals(TINY_PNG.subarray(0, 8)));
  assert.match(out.toString("utf8"), /XML:com\.adobe\.xmp/);
  assert.match(out.toString("utf8"), /Red pixel product shot/);
  assert.match(out.toString("utf8"), /AltTextAccessibility/);
  assert.ok(out.includes(Buffer.from("eXIf")));
  // Still a valid PNG ending
  assert.equal(out.subarray(-8).toString("ascii").includes("IEND"), true);
});

test("PNG fallback replaces prior XMP chunk on re-inject", () => {
  const once = injectPngMetadata(TINY_PNG, makeAi("first caption"));
  const twice = injectPngMetadata(once, makeAi("second caption"));
  const text = twice.toString("utf8");
  assert.match(text, /second caption/);
  assert.equal(text.includes("first caption"), false);
});

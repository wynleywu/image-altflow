import type { AiImageResult } from "./types";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fullDescription(ai: AiImageResult): string {
  return (ai.image_description_en || ai.caption_en || ai.alt_text_en).trim();
}

function seg(marker: number, payload: Buffer): Buffer {
  const len = payload.length + 2;
  if (len > 0xffff) {
    throw new Error(`JPEG metadata segment exceeds 65535 bytes (${len})`);
  }
  const hdr = Buffer.from([0xFF, marker, (len >> 8) & 0xFF, len & 0xFF]);
  return Buffer.concat([hdr, payload]);
}

function asciiExifValue(value: string, maxLen: number): Buffer {
  // EXIF ASCII type is 7-bit; strip non-ASCII so we never emit invalid bytes.
  const cleaned = value.replace(/[^\x20-\x7E]/g, " ").trim().slice(0, maxLen);
  return Buffer.from(`${cleaned || " "}\0`, "ascii");
}

function buildExifTiff(description: string): Buffer {
  const desc = asciiExifValue(description, 1000);
  const entryCount = 1;
  const ifdOffset = 8;
  const dataOffset = ifdOffset + 2 + entryCount * 12 + 4;
  const tiff = Buffer.alloc(dataOffset + desc.length);

  tiff.writeUInt16LE(0x4949, 0); // little-endian
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(ifdOffset, 4);
  tiff.writeUInt16LE(entryCount, 8);

  const entryPos = 10;
  const valuePos = dataOffset;

  tiff.writeUInt16LE(0x010E, entryPos); // ImageDescription
  tiff.writeUInt16LE(2, entryPos + 2); // ASCII
  tiff.writeUInt32LE(desc.length, entryPos + 4);
  tiff.writeUInt32LE(valuePos, entryPos + 8);
  desc.copy(tiff, valuePos);

  tiff.writeUInt32LE(0, entryPos + 12); // next IFD = 0
  return tiff;
}

/** JPEG APP1 Exif payload: Exif\\0\\0 + TIFF */
function buildJpegExifPayload(description: string): Buffer {
  return Buffer.concat([Buffer.from("Exif\0\0"), buildExifTiff(description)]);
}

function buildXmpXml(ai: AiImageResult): string {
  const description = fullDescription(ai);
  const tagItems = ai.tags_en
    .slice(0, 25)
    .map((t) => `<rdf:li>${escapeXml(t)}</rdf:li>`)
    .join("");
  return (
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">\n` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n` +
    `<rdf:Description rdf:about=""\n` +
    `  xmlns:dc="http://purl.org/dc/elements/1.1/"\n` +
    `  xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"\n` +
    `  xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">\n` +
    `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(description)}</rdf:li></rdf:Alt></dc:description>\n` +
    (tagItems ? `<dc:subject><rdf:Bag>${tagItems}</rdf:Bag></dc:subject>\n` : "") +
    `<photoshop:Headline>${escapeXml(ai.caption_en)}</photoshop:Headline>\n` +
    `<Iptc4xmpCore:AltTextAccessibility>${escapeXml(ai.alt_text_en)}</Iptc4xmpCore:AltTextAccessibility>\n` +
    `</rdf:Description>\n</rdf:RDF>\n</x:xmpmeta>\n<?xpacket end="w"?>`
  );
}

function exifSeg(description: string): Buffer {
  return seg(0xE1, buildJpegExifPayload(description));
}

function xmpSeg(ai: AiImageResult): Buffer {
  const ns = Buffer.from("http://ns.adobe.com/xap/1.0/\0");
  return seg(0xE1, Buffer.concat([ns, Buffer.from(buildXmpXml(ai), "utf8")]));
}

function iptcSeg(ai: AiImageResult): Buffer {
  const records: Buffer[] = [];

  function addRecord(dataset: number, value: string) {
    const data = Buffer.from(value.slice(0, 2000), "utf8");
    if (data.length === 0) return;
    records.push(Buffer.from([0x1C, 0x02, dataset, (data.length >> 8) & 0xFF, data.length & 0xFF]));
    records.push(data);
  }

  addRecord(0x69, ai.caption_en); // Headline
  addRecord(0x78, fullDescription(ai)); // Caption-Abstract
  for (const kw of ai.tags_en.slice(0, 20)) addRecord(0x19, kw);

  if (records.length === 0) return Buffer.alloc(0);

  const iptcData = Buffer.concat(records);
  const bimLen = Buffer.alloc(4);
  bimLen.writeUInt32BE(iptcData.length, 0);

  const payload = Buffer.concat([
    Buffer.from("Photoshop 3.0\0"),
    Buffer.from([0x38, 0x42, 0x49, 0x4D, 0x04, 0x04, 0x00, 0x00]), // 8BIM IPTC-NAA
    bimLen,
    iptcData,
  ]);
  return seg(0xED, payload);
}

export function injectJpegMetadata(buffer: Buffer, ai: AiImageResult): Buffer {
  if (
    buffer.length < 4
    || buffer[0] !== 0xFF
    || buffer[1] !== 0xD8
    || buffer[2] !== 0xFF
  ) {
    throw new Error("Invalid JPEG image data");
  }

  // Insert after SOI and any leading APP0 (JFIF) segment
  let pos = 2;
  if (buffer[pos] === 0xFF && buffer[pos + 1] === 0xE0) {
    pos += 2 + buffer.readUInt16BE(pos + 2);
  }

  const description = fullDescription(ai);
  const iptc = iptcSeg(ai);
  return Buffer.concat([
    buffer.slice(0, pos),
    exifSeg(description),
    xmpSeg(ai),
    iptc.length > 0 ? iptc : Buffer.alloc(0),
    buffer.slice(pos),
  ]);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_XMP_KEYWORD = "XML:com.adobe.xmp";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function pngCrc(typeAndData: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < typeAndData.length; i += 1) {
    c = CRC_TABLE[(c ^ typeAndData[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(pngCrc(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function makeItxtChunk(keyword: string, text: string): Buffer {
  const data = Buffer.concat([
    Buffer.from(keyword, "latin1"),
    Buffer.from([0x00, 0x00, 0x00]), // null, compressionFlag=0, compressionMethod=0
    Buffer.from([0x00]), // empty language tag + null
    Buffer.from([0x00]), // empty translated keyword + null
    Buffer.from(text, "utf8"),
  ]);
  return makePngChunk("iTXt", data);
}

function makeTextChunk(keyword: string, text: string): Buffer {
  // tEXt is Latin-1; strip non-Latin-1 for safety
  const cleaned = text.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ").trim().slice(0, 2000);
  const data = Buffer.concat([
    Buffer.from(keyword, "latin1"),
    Buffer.from([0x00]),
    Buffer.from(cleaned || " ", "latin1"),
  ]);
  return makePngChunk("tEXt", data);
}

function readPngTextKeyword(type: string, data: Buffer): string | null {
  if (type !== "tEXt" && type !== "iTXt" && type !== "zTXt") return null;
  const nul = data.indexOf(0);
  if (nul <= 0) return null;
  return data.subarray(0, nul).toString("latin1");
}

function shouldDropPngChunk(type: string, data: Buffer): boolean {
  if (type === "eXIf") return true;
  const keyword = readPngTextKeyword(type, data);
  if (!keyword) return false;
  if (keyword === PNG_XMP_KEYWORD) return true;
  if (keyword === "Description" || keyword === "Title" || keyword === "Comment") return true;
  return false;
}

export function injectPngMetadata(buffer: Buffer, ai: AiImageResult): Buffer {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Invalid PNG image data");
  }

  type Chunk = { type: string; data: Buffer; raw: Buffer };
  const chunks: Chunk[] = [];
  let offset = 8;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > buffer.length) {
      throw new Error("Invalid PNG chunk bounds");
    }
    const data = buffer.subarray(dataStart, dataEnd);
    const raw = buffer.subarray(offset, chunkEnd);
    chunks.push({ type, data, raw });
    offset = chunkEnd;
    if (type === "IEND") break;
  }

  if (chunks.length === 0 || chunks[0].type !== "IHDR") {
    throw new Error("Invalid PNG: missing IHDR");
  }
  if (chunks[chunks.length - 1].type !== "IEND") {
    throw new Error("Invalid PNG: missing IEND");
  }

  const kept = chunks.filter((chunk) => !shouldDropPngChunk(chunk.type, chunk.data));
  const idatIndex = kept.findIndex((chunk) => chunk.type === "IDAT");
  if (idatIndex < 0) {
    throw new Error("Invalid PNG: missing IDAT");
  }

  const description = fullDescription(ai).slice(0, 2000);
  const headline = (ai.caption_en || ai.alt_text_en).slice(0, 200);
  const metaChunks = [
    makePngChunk("eXIf", buildExifTiff(description)),
    makeItxtChunk(PNG_XMP_KEYWORD, buildXmpXml(ai)),
    makeTextChunk("Description", description),
    makeTextChunk("Title", headline),
  ];

  const out: Buffer[] = [PNG_SIGNATURE];
  for (let i = 0; i < kept.length; i += 1) {
    if (i === idatIndex) {
      for (const meta of metaChunks) out.push(meta);
    }
    out.push(kept[i].raw);
  }
  return Buffer.concat(out);
}

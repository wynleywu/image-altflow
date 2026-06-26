import type { AiImageResult } from "./types";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function seg(marker: number, payload: Buffer): Buffer {
  const len = payload.length + 2;
  const hdr = Buffer.from([0xFF, marker, (len >> 8) & 0xFF, len & 0xFF]);
  return Buffer.concat([hdr, payload]);
}

function exifSeg(altText: string): Buffer {
  const desc = Buffer.from(altText.slice(0, 1000) + "\0", "ascii");
  // Minimal TIFF: II + magic 42 + IFD0 offset 8
  const ifdOffset = 8;
  const dataOffset = ifdOffset + 2 + 1 * 12 + 4; // count(2) + 1 entry(12) + next-IFD(4)
  const tiff = Buffer.alloc(dataOffset + desc.length);

  tiff.writeUInt16LE(0x4949, 0);          // little-endian
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(ifdOffset, 4);
  tiff.writeUInt16LE(1, 8);              // 1 IFD entry
  tiff.writeUInt16LE(0x010E, 10);        // ImageDescription tag
  tiff.writeUInt16LE(2, 12);             // ASCII
  tiff.writeUInt32LE(desc.length, 14);
  tiff.writeUInt32LE(dataOffset, 18);
  tiff.writeUInt32LE(0, 22);             // next IFD = 0
  desc.copy(tiff, dataOffset);

  return seg(0xE1, Buffer.concat([Buffer.from("Exif\0\0"), tiff]));
}

function xmpSeg(ai: AiImageResult): Buffer {
  const tagItems = ai.tags_en
    .slice(0, 25)
    .map((t) => `<rdf:li>${escapeXml(t)}</rdf:li>`)
    .join("");
  const xml =
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">\n` +
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n` +
    `<rdf:Description rdf:about=""\n` +
    `  xmlns:dc="http://purl.org/dc/elements/1.1/"\n` +
    `  xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/">\n` +
    `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(ai.image_description_en || ai.caption_en)}</rdf:li></rdf:Alt></dc:description>\n` +
    (tagItems ? `<dc:subject><rdf:Bag>${tagItems}</rdf:Bag></dc:subject>\n` : "") +
    `<Iptc4xmpExt:AltTextAccessibility>${escapeXml(ai.alt_text_en)}</Iptc4xmpExt:AltTextAccessibility>\n` +
    `</rdf:Description>\n</rdf:RDF>\n</x:xmpmeta>\n<?xpacket end="w"?>`;

  const ns = Buffer.from("http://ns.adobe.com/xap/1.0/\0");
  return seg(0xE1, Buffer.concat([ns, Buffer.from(xml, "utf8")]));
}

function iptcSeg(ai: AiImageResult): Buffer {
  const records: Buffer[] = [];

  function addRecord(dataset: number, value: string) {
    const data = Buffer.from(value.slice(0, 2000), "utf8");
    if (data.length === 0) return;
    records.push(Buffer.from([0x1C, 0x02, dataset, (data.length >> 8) & 0xFF, data.length & 0xFF]));
    records.push(data);
  }

  addRecord(0x78, ai.caption_en);
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
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return buffer; // not JPEG

  // Insert after SOI and any leading APP0 (JFIF) segment
  let pos = 2;
  if (buffer[pos] === 0xFF && buffer[pos + 1] === 0xE0) {
    pos += 2 + buffer.readUInt16BE(pos + 2);
  }

  const iptc = iptcSeg(ai);
  return Buffer.concat([
    buffer.slice(0, pos),
    exifSeg(ai.alt_text_en),
    xmpSeg(ai),
    iptc.length > 0 ? iptc : Buffer.alloc(0),
    buffer.slice(pos),
  ]);
}

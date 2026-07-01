import type { AiImageResult, EmbedDownloadPayload } from "./types";

export type EmbeddedField = { tag: string; label: string; value: string };
export type EmbeddedGroup = { name: "EXIF" | "IPTC" | "XMP"; fields: EmbeddedField[] };

function pushField(
  groups: Map<EmbeddedGroup["name"], EmbeddedField[]>,
  group: EmbeddedGroup["name"],
  tag: string,
  label: string,
  value: string | undefined,
) {
  const trimmed = value?.trim();
  if (!trimmed) return;
  const list = groups.get(group) ?? [];
  list.push({ tag, label, value: trimmed });
  groups.set(group, list);
}

export function getEmbeddedMetadataGroups(ai: AiImageResult, fileName: string): EmbeddedGroup[] {
  const groups = new Map<EmbeddedGroup["name"], EmbeddedField[]>();

  pushField(groups, "EXIF", "EXIF:ImageDescription", "Alt Text", ai.alt_text_en);
  if (ai.model) pushField(groups, "EXIF", "EXIF:Model", "Model", ai.model);
  pushField(groups, "EXIF", "Download filename", "File name", fileName);

  pushField(groups, "IPTC", "IPTC:Caption-Abstract", "Caption", ai.caption_en);
  if (ai.tags_en.length > 0) {
    pushField(groups, "IPTC", "IPTC:Keywords", "Keywords", ai.tags_en.join(", "));
  }
  if (ai.brand) pushField(groups, "IPTC", "IPTC:Credit", "Brand", ai.brand);

  pushField(groups, "XMP", "XMP-iptcExt:AltTextAccessibility", "Alt Text (accessibility)", ai.alt_text_en);
  pushField(
    groups,
    "XMP",
    "XMP-dc:Description",
    "Description",
    ai.image_description_en || ai.caption_en,
  );
  if (ai.tags_en.length > 0) {
    pushField(groups, "XMP", "XMP-dc:Subject", "Subject tags", ai.tags_en.join(", "));
  }

  const order: EmbeddedGroup["name"][] = ["EXIF", "IPTC", "XMP"];
  return order
    .map((name) => ({ name, fields: groups.get(name) ?? [] }))
    .filter((group) => group.fields.length > 0);
}

export function buildEmbeddedImageUrl(
  download?: EmbedDownloadPayload,
  previewUrl?: string,
): string | null {
  if (download?.base64 && download.mimeType) {
    return `data:${download.mimeType};base64,${download.base64}`;
  }
  return previewUrl || null;
}

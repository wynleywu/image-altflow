import type { AiImageResult, EmbedDownloadPayload } from "./types";

export type EmbeddedField = { tag: string; label: string; value: string };
export type EmbeddedGroup = {
  name: "Download" | "EXIF" | "IPTC" | "XMP";
  fields: EmbeddedField[];
};

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
  const fullDescription = ai.image_description_en || ai.caption_en;

  pushField(groups, "Download", "Download filename", "File Name", fileName);

  pushField(groups, "EXIF", "EXIF:ImageDescription", "ImageDescription", fullDescription);

  pushField(groups, "IPTC", "IPTC:Caption-Abstract", "Caption-Abstract", fullDescription);
  if (ai.tags_en.length > 0) {
    pushField(groups, "IPTC", "IPTC:Keywords", "Keywords", ai.tags_en.join(", "));
  }

  pushField(
    groups,
    "XMP",
    "XMP-iptcCore:AltTextAccessibility",
    "Iptc4xmpCore:AltTextAccessibility",
    ai.alt_text_en,
  );
  pushField(groups, "XMP", "XMP-photoshop:Headline", "photoshop:Headline", ai.caption_en);
  pushField(groups, "XMP", "XMP-dc:Description", "dc:description", fullDescription);
  if (ai.tags_en.length > 0) {
    pushField(groups, "XMP", "XMP-dc:Subject", "dc:subject", ai.tags_en.join(", "));
  }

  const order: EmbeddedGroup["name"][] = ["Download", "EXIF", "IPTC", "XMP"];
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

import type { AiImageResult, EmbedDownloadPayload } from "./types";

export type EmbeddedField = { tag: string; label: string; value: string };
export type EmbeddedGroup = {
  name: "Download" | "AltText" | "Headline" | "Keywords" | "Description";
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

  pushField(
    groups,
    "AltText",
    "XMP-iptcCore:AltTextAccessibility",
    "AltTextAccessibility",
    ai.alt_text_en,
  );

  pushField(groups, "Headline", "IPTC:Headline", "IPTC:Headline", ai.caption_en);
  pushField(groups, "Headline", "XMP-photoshop:Headline", "photoshop:Headline", ai.caption_en);

  if (ai.tags_en.length > 0) {
    const keywords = ai.tags_en.join(", ");
    pushField(groups, "Keywords", "IPTC:Keywords", "IPTC:Keywords", keywords);
    pushField(groups, "Keywords", "XMP-dc:Subject", "dc:subject", keywords);
  }

  pushField(groups, "Description", "IPTC:Caption-Abstract", "Caption-Abstract", fullDescription);
  pushField(groups, "Description", "XMP-dc:Description", "dc:description", fullDescription);
  pushField(groups, "Description", "EXIF:ImageDescription", "ImageDescription", fullDescription);

  const order: EmbeddedGroup["name"][] = ["Download", "AltText", "Headline", "Keywords", "Description"];
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

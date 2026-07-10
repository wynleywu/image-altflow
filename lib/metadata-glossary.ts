export type MetadataGlossaryEntry = {
  key: string;
  tags: string;
  description: string;
};

export const METADATA_STANDARDS: { name: string; summary: string }[] = [
  {
    name: "下载信息",
    summary: "成品图下载文件名（SEO 友好命名）。",
  },
  {
    name: "EXIF",
    summary: "写入 ImageDescription，与完整 Description 保持一致。",
  },
  {
    name: "IPTC",
    summary: "写入 Caption-Abstract（完整描述）与 Keywords（关键词数组）。",
  },
  {
    name: "XMP",
    summary: "写入 AltTextAccessibility、Headline、dc:description、dc:subject。",
  },
];

export const METADATA_GLOSSARY: MetadataGlossaryEntry[] = [
  {
    key: "File Name",
    tags: "下载文件名",
    description: "下载时使用的 SEO 友好文件名。",
  },
  {
    key: "ImageDescription",
    tags: "EXIF ImageDescription",
    description: "与完整 Description / IPTC Caption-Abstract 保持一致。",
  },
  {
    key: "Caption-Abstract",
    tags: "IPTC Caption-Abstract · XMP dc:description",
    description: "完整图片描述，供图库与 SEO 使用。",
  },
  {
    key: "Keywords",
    tags: "IPTC Keywords · XMP dc:subject",
    description: "多值关键词，提升搜索与分类匹配。",
  },
  {
    key: "AltTextAccessibility",
    tags: "XMP Iptc4xmpCore:AltTextAccessibility",
    description: "简洁无障碍替代文本。",
  },
  {
    key: "Headline",
    tags: "XMP photoshop:Headline",
    description: "一句话摘要，短于完整描述。",
  },
];

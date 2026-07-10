export type MetadataGlossaryEntry = {
  key: string;
  tags: string;
  description: string;
};

export const METADATA_STANDARDS: { name: string; summary: string }[] = [
  {
    name: "下载文件名",
    summary: "成品图 SEO 友好文件名。",
  },
  {
    name: "Alt Text",
    summary: "写入 XMP-iptcCore:AltTextAccessibility，简洁无障碍替代文本。",
  },
  {
    name: "Headline",
    summary: "写入 IPTC:Headline 与 XMP-photoshop:Headline，一句话摘要。",
  },
  {
    name: "Keywords",
    summary: "写入 IPTC:Keywords 与 XMP-dc:Subject，多值关键词。",
  },
  {
    name: "Description",
    summary: "写入 IPTC:Caption-Abstract、XMP-dc:Description；EXIF:ImageDescription 作兼容。",
  },
];

export const METADATA_GLOSSARY: MetadataGlossaryEntry[] = [
  {
    key: "下载文件名",
    tags: "Download File Name",
    description: "下载时使用的 SEO 友好文件名。",
  },
  {
    key: "Alt Text",
    tags: "XMP-iptcCore:AltTextAccessibility",
    description: "简洁无障碍替代文本。",
  },
  {
    key: "Headline",
    tags: "IPTC:Headline · XMP-photoshop:Headline",
    description: "一句话摘要，短于完整描述。",
  },
  {
    key: "Keywords",
    tags: "IPTC:Keywords · XMP-dc:Subject",
    description: "多值关键词，提升搜索与分类匹配。",
  },
  {
    key: "Description",
    tags: "IPTC:Caption-Abstract · XMP-dc:Description · EXIF:ImageDescription",
    description: "完整图片描述；EXIF ImageDescription 为可选兼容字段。",
  },
];

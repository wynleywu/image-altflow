export type MetadataGlossaryEntry = {
  key: string;
  tags: string;
  description: string;
};

export const METADATA_STANDARDS: { name: string; summary: string }[] = [
  {
    name: "EXIF",
    summary: "相机/图片基础信息，本应用写入 Alt Text、型号、下载文件名。",
  },
  {
    name: "IPTC",
    summary: "新闻/图库常用字段，写入 Caption、关键词、品牌。",
  },
  {
    name: "XMP",
    summary: "Adobe 扩展元数据，写入无障碍 Alt、描述、主题标签。",
  },
];

export const METADATA_GLOSSARY: MetadataGlossaryEntry[] = [
  {
    key: "Alt Text",
    tags: "EXIF ImageDescription · XMP AltTextAccessibility",
    description: "图片替代文字，供无障碍阅读与 SEO 使用。",
  },
  {
    key: "文件名",
    tags: "下载文件名",
    description: "下载时使用的 SEO 友好文件名。",
  },
  {
    key: "品牌 / 型号",
    tags: "IPTC Credit · EXIF Model",
    description: "产品品牌与型号，便于归档与检索。",
  },
  {
    key: "Caption",
    tags: "IPTC Caption-Abstract",
    description: "简短图注，概括图片主要内容。",
  },
  {
    key: "Tags",
    tags: "IPTC Keywords · XMP Subject",
    description: "关键词标签，提升搜索与分类匹配。",
  },
  {
    key: "Description",
    tags: "XMP dc:description",
    description: "较长英文描述，补充 SEO 正文信息。",
  },
];

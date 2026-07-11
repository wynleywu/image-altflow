export type MetadataGlossaryEntry = {
  key: string;
  tags: string;
  description: string;
};

export const HELP_DIALOG_INTRO =
  "把一张图片想成商品包装盒。你只需填写一次文案；系统会按字段自动写入 IPTC 与/或 XMP。";

export const HELP_DIALOG_INTRO_EMPHASIS =
  "双写主要有兼容性原因，但不只是兼容性。";

export const METADATA_STANDARDS: { name: string; summary: string }[] = [
  {
    name: "IPTC",
    summary: "规定图片应有哪些业务字段，如标题、描述、关键词、版权。旧图库更常读它。",
  },
  {
    name: "XMP",
    summary: "用现代、可扩展的方式把字段存进图片。Photoshop / Lightroom 等更常读它。",
  },
  {
    name: "EXIF",
    summary: "主要记录相机、拍摄时间、尺寸等技术信息；本应用也会把 Description 写入 ImageDescription 作兼容。",
  },
];

export const DUAL_WRITE_REASONS: string[] = [
  "旧图库、旧编辑软件可能只读 IPTC",
  "现代软件更偏向读 XMP",
  "网站上传 / 素材库导入时，各平台支持不一",
  "双写后跨软件传递更稳，减少字段丢失",
];

export const DUAL_WRITE_EXAMPLE =
  "同一组 Keywords 会同时进 IPTC:Keywords 与 XMP-dc:Subject——内容相同，只是存储位置不同。";

export const DUAL_WRITE_CONCLUSION =
  "IPTC 负责定义业务字段，XMP 负责现代化存储和扩展；双写主要是为了兼容不同软件。";

export const XMP_BEYOND_NOTE =
  "XMP 不只是 IPTC 的备份：它还能保存 IPTC 没有或旧 IPTC 放不下的内容（如 AltText Accessibility）。本工具里 Keywords、Description、Headline 同时写 IPTC + XMP；AltText 主要放 XMP。";

export const METADATA_GLOSSARY: MetadataGlossaryEntry[] = [
  {
    key: "下载文件名",
    tags: "Download File Name",
    description: "下载时使用的 SEO 友好文件名。",
  },
  {
    key: "Alt Text",
    tags: "XMP-iptcCore:AltTextAccessibility",
    description: "简洁无障碍替代文本；主要写入 XMP。",
  },
  {
    key: "Headline",
    tags: "IPTC:Headline · XMP-photoshop:Headline",
    description: "一句话摘要，短于完整描述；IPTC + XMP 双写。",
  },
  {
    key: "Keywords",
    tags: "IPTC:Keywords · XMP-dc:Subject",
    description: "多值关键词，提升搜索与分类匹配；IPTC + XMP 双写。",
  },
  {
    key: "Description",
    tags: "IPTC:Caption-Abstract · XMP-dc:Description · EXIF:ImageDescription",
    description: "完整图片描述；IPTC + XMP 双写，EXIF ImageDescription 作兼容。",
  },
];

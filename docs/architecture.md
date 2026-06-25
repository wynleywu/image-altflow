# Architecture

> 最后更新：2026-06-25

## 概述

Image Altflow 将产品图经 Gemini 识图后，把 **英文** SEO 文案（Alt、Caption、Tags、Description）写入图片 EXIF/XMP/IPTC，供素材库与 CMS 使用。中文文案仅用于对照与校对，不写入二进制。

当前交付形态：**CLI + HTTP API**；Web UI 为阶段二。

## 数据流

```text
┌─────────────┐     analyze      ┌──────────────┐
│ 本地 JPEG   │ ───────────────► │ AiImageResult │
│ / PNG       │   lib/gemini.ts  │ (_en + _zh)   │
└─────────────┘                  └───────┬───────┘
                                       │ 用户可改 JSON（CLI --ai）
                                       ▼ embed
                               ┌───────────────────┐
                               │ lib/embed-metadata │
                               │ (exiftool-vendored)│
                               └─────────┬─────────┘
                                         ▼
                               ┌───────────────────┐
                               │ 成品图（磁盘/API）  │
                               └───────────────────┘
```

## 模块职责

| 模块 | 文件 | 说明 |
|------|------|------|
| Prompt | `lib/prompt.ts` | 要求 Gemini 输出双语 JSON |
| 识图 | `lib/gemini.ts` | `analyzeImageFromBuffer` |
| 元数据 | `lib/embed-metadata.ts` | ExifTool 写 `alt_text_en` 等 |
| 编排 | `lib/pipeline.ts` | analyze / embed 统一入口 |
| 文件名 | `lib/filename.ts` | 下载名消毒与扩展名 |
| 持久化判断 | `lib/persist.ts` | `canPersistRecords` / `canPersistAll` |
| CLI | `scripts/process-image.ts` | 读 `.env.local`，写侧车 `*.ai.json` |

## AiImageResult（双语）

Gemini 返回字段示例：

- `alt_text_en` / `alt_text_zh`
- `caption_en` / `caption_zh`
- `tags_en` / `tags_zh`（数组）
- `image_description_en` / `image_description_zh`
- `new_file_name`（仅英文）
- `product_type_*`, `main_color_*`, `scene_*`
- `confidence_note`: `certain` | `uncertain`

**Embed 时只读取 `*_en` 与 `new_file_name`。**

## 写入的图片元数据

| 源字段 | ExifTool 标签 |
|--------|----------------|
| `alt_text_en` | `XMP-iptcExt:AltTextAccessibility`, `EXIF:ImageDescription` |
| `caption_en` | `IPTC:Caption-Abstract` |
| `tags_en` | `IPTC:Keywords` |
| `image_description_en` | `XMP-dc:Description` |

推荐 **JPEG**；PNG 元数据在部分工具中可见性较差。

## HTTP API

| 端点 | 职责 |
|------|------|
| `POST /api/analyze` | 识图；返回 base64 原图 + `ai` |
| `POST /api/embed` | 写元数据；返回 base64 成品 + `fileName` |

两步设计与前端阶段二一致：先 analyze，用户编辑后再 embed。

## 可选持久化

当环境变量齐备时：

- `POSTGRES_URL` → `image_records` 表（`lib/records.ts`）
- `BLOB_READ_WRITE_TOKEN` + `POSTGRES_URL` → embed 后将**成品图**存入 Blob（`lib/storage.persistProcessedBuffer`）

未配置时不影响 CLI / API 主路径。库中 `alt_text` 等列存英文；完整双语 JSON 可存于 `manual_note`。

## Data Model（Neon，可选）

表 `image_records`（`lib/db.ts` 自动建表）主要字段：

- `image_url` — Blob 成品 URL（可选）
- `alt_text`, `caption`, `tags` — 英文档快照
- `manual_note` — 完整 `AiImageResult` JSON（双语）
- `flow_status`, `review_status` — 旧审核 UI 遗留字段

## 与 Legacy 方案的关系

| 时期 | 方案 | 文档 |
|------|------|------|
| 2026-06 早期 | n8n + 飞书多维表格 + 人工审核 | `docs/workflow-spec.md`, `docs/mvp-test-plan.md` |
| 2026-06 起 | Next.js + CLI/API + 元数据写入 | 本文档 |

`n8n/` 目录为工作流存档，非主路径。

## 未实现

- 前端中英对照 UI（阶段二）
- Shopify Admin API 回写 Alt
- 批量目录处理

# Architecture

> 最后更新：2026-07-10

## 概述

Image Altflow 将产品图经视觉模型识图后，把 **英文** SEO 文案写入图片 EXIF/XMP/IPTC（完整描述、Headline、无障碍 Alt、关键词），供素材库与 CMS 使用。中文文案仅用于对照与校对，不写入二进制。

当前交付形态：**CLI + HTTP API + Web 单张/批量流程**（`app/page.tsx`）+ **Amazon Listing 审查**（`app/amazon/page.tsx`）。旧 `/review` 已下线。批量 Tab 在浏览器端串行调用既有 `/api/analyze`、`/api/embed`（并发=1，失败自动重试），完成后打包 ZIP 下载。

## 数据流

```text
┌─────────────┐     analyze      ┌──────────────┐
│ 本地 JPEG   │ ───────────────► │ AiImageResult │
│ / PNG       │ lib/ai.ts        │ (_en + _zh)   │
│             │ (Gemini/ModelScope/CF)│            │
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

## Amazon Listing 审查工作台

```text
ASIN / URL ──► Rainforest API ──► AmazonListingSnapshot
       │                              │
       └── manual paste ──────────────┤
                                      ▼
                            lib/amazon/audit-listing.ts
                            (ModelScope text / Gemini)
                                      ▼
                            ListingAuditResult V2
                                      │
                                      ▼
                      localStorage AmazonAuditWorkspace
                      诊断 → 编辑 → 确认 → 最终 Listing
```

| 模块 | 文件 | 说明 |
|------|------|------|
| ASIN 解析 | `lib/amazon/asin.ts` | URL / ASIN 提取 |
| 抓取 | `lib/amazon/fetch-listing.ts` | Rainforest `type=product`；需 `RAINFOREST_API_KEY` |
| 规则配置 | `lib/amazon/rules.ts` | 区分确认规则、类目建议与启发式建议 |
| 审查 Prompt | `lib/amazon/listing-audit-prompt.ts` | 分项评分、证据、影响、置信度与适老品类建议 |
| 结果标准化 | `lib/amazon/normalize-audit.ts` | V2 输出清洗；旧结果补安全默认值 |
| 适老清单 | `lib/amazon/mobility-checklist.ts` | 属性字段与同义词参考 |
| API | `POST /api/amazon/audit` | `{ asin \| manual }` → snapshot + audit |
| 本地工作区 | `lib/amazon/workspace.ts` | `auditId` 隔离、localStorage 恢复、最近 10 条清理 |
| UI | `app/amazon/_components/audit-report.tsx` | 编辑、接受/重置、词级差异、最终稿汇总 |

`/amazon/result?id=<auditId>` 从浏览器本地工作区恢复完整状态。属性建议始终标记为待核验，不自动进入最终稿。工作区不进入 Neon，也不跨设备同步。

## 模块职责

| 模块 | 文件 | 说明 |
|------|------|------|
| Prompt | `lib/prompt.ts` | 要求模型输出双语 JSON |
| 识图路由 | `lib/ai.ts` | 按 `AI_PROVIDER` 选择 Gemini、ModelScope 或 Cloudflare；55 秒总预算内按已配置提供商分配时间并回退 |
| Gemini | `lib/gemini.ts` | `analyzeImageFromBuffer`；`normalizeAiResult` 共用 |
| ModelScope | `lib/modelscope.ts` | `api-inference.modelscope.cn` OpenAI 兼容；推荐 Qwen3-VL |
| Cloudflare | `lib/cloudflare.ts` | Workers AI REST API；默认 Llama 3.2 11B Vision；逐行字段协议、字段级清洗，在分配的超时预算内最多重试一次 |
| 元数据 | `lib/embed-metadata.ts` | ExifTool 写 `alt_text_en` 等 |
| Embed 输入校验 | `lib/embed-validation.ts` | 严格 Base64、图片签名、MIME 一致性、请求体大小 |
| 编排 | `lib/pipeline.ts` | analyze / embed 统一入口 |
| 文件名 | `lib/filename.ts` | 下载名消毒与扩展名 |
| 持久化判断 | `lib/persist.ts` | `canPersistRecords` / `canPersistAll` |
| CLI | `scripts/process-image.ts` | 读 `.env.local`，写侧车 `*.ai.json` |

## AiImageResult（双语）

Gemini、ModelScope 或 Cloudflare 返回字段示例：

- `alt_text_en` / `alt_text_zh`
- `caption_en` / `caption_zh`
- `tags_en` / `tags_zh`（数组）
- `image_description_en` / `image_description_zh`
- `new_file_name`（仅英文）
- `product_type_*`, `main_color_*`, `scene_*`
- `confidence_note`: `certain` | `uncertain`

**Embed 时只读取 `*_en` 与 `new_file_name`。**

## 写入的图片元数据

| 源字段 | 写入位置 |
|--------|----------|
| `new_file_name` | 下载 File Name |
| `image_description_en` | `EXIF:ImageDescription`、`IPTC:Caption-Abstract`、`XMP-dc:Description` |
| `caption_en` | `XMP-photoshop:Headline`（一句话摘要） |
| `alt_text_en` | `XMP-iptcCore:AltTextAccessibility` |
| `tags_en` | `IPTC:Keywords`、`XMP-dc:Subject` |

品牌 / 型号仅作 Prompt 上下文，**不写入**成品图。推荐 **JPEG**；云端 ExifTool 不可用时，JPEG / PNG 走 JS 兜底写入（PNG：`eXIf` + XMP `iTXt`）。WebP / GIF 仍依赖 ExifTool。

## HTTP API

| 端点 | 职责 |
|------|------|
| `POST /api/analyze` | 识图（仅 multipart）；返回 base64 原图 + `ai` |
| `POST /api/embed` | 写元数据；返回 base64 成品 + `fileName` |
| `POST /api/amazon/audit` | ASIN 抓取 + Listing SEO 审查（适老品类） |
| `GET/PATCH /api/records*` | 可选历史；需 `RECORDS_API_SECRET` Bearer |

两步设计与前端阶段二一致：先 analyze，用户编辑后再 embed。不接受 `image_url` 代抓。Embed 仅接受不超过 5 MB 的有效 JPEG、PNG、WebP 或 GIF，并在写入前校验 AI 必填字段、字段长度和 JPEG 段大小。

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
| 2026-06 起 | Next.js + CLI/API/Web + 元数据写入 + Vercel | 本文档 |

`n8n/` 目录为工作流存档，非主路径。

## 未实现

- Shopify Admin API 回写 Alt
- 批量目录（CLI 侧）处理
- Amazon 审查 → 多版本生成、云端历史、Sanity/SP-API 直连

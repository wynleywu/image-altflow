# Image Altflow — Agent 指南

> 最后对齐：2026-06-26。面向在本仓库内协作的 AI。

## 当前阶段

- **阶段一（已完成）**：CLI + HTTP API + 核心库；双语识图（Gemini / ModelScope）；英文元数据写入图片（ExifTool）。
- **阶段二（进行中）**：首页单张流程已接 API；**Vercel 生产已部署**（2026-06-26）；批量 Tab 占位；`app/review` 仍为旧版。
- **Legacy**：`docs/mvp-test-plan.md`、`docs/workflow-spec.md`、`n8n/` 描述早期飞书/n8n 方案，勿按其实现。

## 技术栈

Next.js 15 App Router · Gemini / ModelScope · `exiftool-vendored` · 可选 Neon + Vercel Blob

## 核心流程（两步）

```text
analyze：本地图 → lib/ai.ts（Gemini 或 ModelScope）→ 双语 AiImageResult（JSON）
embed：原图 buffer + ai（仅 _en 字段）→ EXIF/XMP/IPTC → 成品图
```

编排入口：`lib/pipeline.ts`（CLI 与 API 共用，勿在 route 里重复逻辑）。

## 路由

| 路由 | 方法 | 用途 |
|------|------|------|
| `/api/analyze` | POST | `multipart` 字段 `image`；返回 `ai` + `originalImageBase64` |
| `/api/embed` | POST | JSON：`imageBase64`, `mimeType`, `ai`；返回 `download` |
| `/api/records` | GET | 可选历史（需 `POSTGRES_URL`） |
| `/api/records/[recordId]` | PATCH | 可选审核字段更新（旧 UI 用） |

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_PROVIDER` | 否 | `gemini` 或 `modelscope`；未设置默认 `modelscope` |
| `GEMINI_API_KEY` | `AI_PROVIDER=gemini` 时 | Gemini 识图 |
| `GEMINI_MODEL` | 否 | 默认 `gemini-3.1-flash-lite` |
| `MODELSCOPE_API_KEY` | 默认 provider 路径时 | ModelScope 识图 |
| `MODELSCOPE_MODEL` | 否 | 推荐 `Qwen/Qwen3-VL-30B-A3B-Instruct`（`.env.example`）；代码回退默认同左 |
| `POSTGRES_URL` | 否 | Neon；仅 `canPersistRecords()` 时写库 |
| `BLOB_READ_WRITE_TOKEN` | 否 | 成品图云存储；需与 Postgres 同时配置才在 embed 时持久化 |

## 关键文件

| 路径 | 职责 |
|------|------|
| `lib/ai.ts` | `analyzeImageFromBuffer` 路由（Gemini / ModelScope） |
| `lib/gemini.ts` | Gemini 实现；`normalizeAiResult` 共用 |
| `lib/modelscope.ts` | ModelScope OpenAI 兼容接口（Qwen3-VL 等） |
| `lib/embed-metadata.ts` | `embedMetadataIntoImage`（只写 `_en`） |
| `lib/pipeline.ts` | `analyzeLocalImage`, `embedImageBuffer`, `parseAiFromJson` |
| `scripts/process-image.ts` | 本地 CLI：`npm run process --` |

## 本地命令

```bash
npm run process -- ./input.jpg ./output.jpg
npm run process -- ./input.jpg --analyze-only
npm run process -- ./input.jpg ./output.jpg --ai ./input.ai.json
npm run build
```

## 红线

- 写入图片元数据**只用英文字段**（`alt_text_en` 等）。
- 单张流程 UI 已在 `app/page.tsx`；勿随意改 `app/review/*` 或批量 Tab，除非用户明确要求。
- 不要恢复飞书依赖；`lib/feishu.ts` 已删除。

## 文档索引

- 接入：`docs/integration-guide.md`
- 架构：`docs/architecture.md`
- 运维：`docs/runbook.md`
- 进度：`docs/handoff.md`
- 设计 token：`docs/figma-design-system.md`

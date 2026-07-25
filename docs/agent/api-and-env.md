# API、环境变量与关键文件

## 核心流程

```text
analyze：本地图 → lib/ai.ts（Gemini / ModelScope / Cloudflare）→ 双语 AiImageResult（JSON）
embed：原图 buffer + ai（仅 _en 字段）→ EXIF/XMP/IPTC → 成品图
```

编排入口：`lib/pipeline.ts`（CLI 与 API 共用，勿在 route 里重复逻辑）。

## 路由

| 路由 | 方法 | 用途 |
|------|------|------|
| `/api/analyze` | POST | `multipart` 字段 `image`；返回 `ai` + `originalImageBase64`（不支持 `image_url`） |
| `/api/embed` | POST | JSON：`imageBase64`, `mimeType`, `ai`；返回 `download` |
| `/api/records` | GET | 可选历史（需 `POSTGRES_URL` + `RECORDS_API_SECRET`） |
| `/api/records/[recordId]` | PATCH | 可选审核字段更新（需 Bearer） |
| `/api/amazon/audit` | POST | ASIN/URL 抓取或手动 Listing；返回 V2 诊断与建议稿 |

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_PROVIDER` | 否 | `gemini`、`modelscope` 或 `cloudflare`；未设置默认 `modelscope` |
| `GEMINI_API_KEY` | `AI_PROVIDER=gemini` 时 | Gemini 识图 |
| `GEMINI_MODEL` | 否 | 默认 `gemini-3.1-flash-lite` |
| `MODELSCOPE_API_KEY` | 默认 provider 路径时 | ModelScope 识图 |
| `MODELSCOPE_MODEL` | 否 | 推荐 `Qwen/Qwen3-VL-30B-A3B-Instruct`（`.env.example`） |
| `CLOUDFLARE_ACCOUNT_ID` | `AI_PROVIDER=cloudflare` 时 | Cloudflare Account ID |
| `CLOUDFLARE_API_TOKEN` | `AI_PROVIDER=cloudflare` 时 | Workers AI Token；禁止提交 Git |
| `CLOUDFLARE_MODEL` | 否 | 默认 `@cf/meta/llama-3.2-11b-vision-instruct` |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | 否 | 同时配置时启用公开 API IP 限流 |
| `POSTGRES_URL` | 否 | Neon；仅 `canPersistRecords()` 时写库 |
| `BLOB_READ_WRITE_TOKEN` | 否 | 成品图云存储；需与 Postgres 同时配置才在 embed 时持久化 |
| `RECORDS_API_SECRET` | 使用 `/api/records*` 时 | Bearer；未配置则 records API 503 |

## 关键文件

| 路径 | 职责 |
|------|------|
| `lib/ai.ts` | `analyzeImageFromBuffer` 路由 |
| `lib/gemini.ts` / `modelscope.ts` / `cloudflare.ts` | 各提供商实现；`normalizeAiResult` 共用 |
| `lib/rate-limit.ts` | 公开 API IP 限流（Upstash；未配置则跳过） |
| `lib/embed-metadata.ts` | 只写 `_en`；ExifTool 失败时 JPEG/PNG 走 JS 兜底 |
| `lib/embed-metadata-js.ts` | JS 元数据注入 |
| `lib/embed-validation.ts` | Base64 / 签名 / MIME 校验 |
| `lib/pipeline.ts` | `analyzeLocalImage`, `embedImageBuffer`, `parseAiFromJson` |
| `scripts/process-image.ts` | 本地 CLI |
| `lib/amazon/normalize-audit.ts` | V2 审查标准化 |
| `lib/amazon/workspace.ts` | localStorage 工作区 |
| `app/amazon/_components/audit-report.tsx` | 可编辑审查工作台 |
| `app/page.tsx` | 首页路由壳 |
| `app/_components/home/use-home-workflow.ts` | 单张/批量状态机 |

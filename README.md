# Image Altflow

AI 图片 SEO 助手：本地上传 → 视觉模型双语识图（Gemini、ModelScope 或 Cloudflare Workers AI）→ **英文元数据写入图片** → 下载成品。

提供 **CLI + HTTP API + Web 单张/批量流程**（`/`）及 **Amazon Listing 审查工作台**（`/amazon`）。生产环境：**https://image-altflow.vercel.app**

## 功能

- 识别产品图，生成中英双语：文件名、Alt Text、Caption、Tags 等
- 将 **英文** Alt/Caption/Tags/Description 写入图片 EXIF/XMP/IPTC
- 本地 CLI 一键处理；HTTP API；Web 单张上传流程
- Web 批量串行分析、失败重试与 ZIP 下载
- Amazon Listing V2 诊断、可编辑建议稿、确认状态、最终稿汇总与浏览器长期保存
- 可选：配置 Postgres + Blob 后自动存历史与成品图

## 快速开始（CLI）

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local：选 AI_PROVIDER，并填入对应 API Key
```

### 识图 + 写入 + 输出

```bash
npm run process -- ./input.jpg ./output.jpg
```

### 仅识图（生成侧车 JSON，可手改后再写入）

```bash
npm run process -- ./input.jpg --analyze-only
# 生成 ./input.jpg.ai.json

# 手改 JSON 后：
npm run process -- ./input.jpg ./output.jpg --ai ./input.jpg.ai.json
```

### 验证元数据（需本机安装 exiftool）

```bash
exiftool -G1 -a ./output.jpg
```

## API

### `POST /api/analyze`

`multipart/form-data`，字段 `image`（文件）。

响应：

```json
{
  "ok": true,
  "ai": { "alt_text_en": "...", "alt_text_zh": "...", ... },
  "originalImageBase64": "...",
  "mimeType": "image/jpeg",
  "originalFileName": "input.jpg"
}
```

### `POST /api/embed`

```json
{
  "imageBase64": "...",
  "mimeType": "image/jpeg",
  "ai": { "new_file_name": "...", "alt_text_en": "...", ... }
}
```

### `POST /api/amazon/audit`

提交 `{ "asin": "B0XXXXXXXX", "marketplace": "US" }`，或提交含 `title`、`bullets` 等字段的 `manual` 对象。返回商品快照与 V2 审查结果；浏览器工作台在本地保存编辑稿，不写入云端数据库。

响应：

```json
{
  "ok": true,
  "download": {
    "fileName": "product-name.jpg",
    "mimeType": "image/jpeg",
    "base64": "..."
  }
}
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_PROVIDER` | 否 | `gemini`、`modelscope` 或 `cloudflare`；未设置时走 ModelScope（失败且已配 `GEMINI_API_KEY` 时回退 Gemini） |
| `GEMINI_API_KEY` | `AI_PROVIDER=gemini` 时 | Google AI Studio |
| `GEMINI_MODEL` | 否 | 默认 `gemini-3.5-flash` |
| `MODELSCOPE_API_KEY` | `AI_PROVIDER=modelscope` 或未设 provider 时 | [ModelScope 令牌](https://modelscope.cn/my/myaccesstoken) |
| `MODELSCOPE_MODEL` | 否 | 推荐 `Qwen/Qwen3-VL-30B-A3B-Instruct` |
| `CLOUDFLARE_ACCOUNT_ID` | `AI_PROVIDER=cloudflare` 时 | Cloudflare Account ID |
| `CLOUDFLARE_API_TOKEN` | `AI_PROVIDER=cloudflare` 时 | 具有 Workers AI 权限的 API Token |
| `CLOUDFLARE_MODEL` | 否 | 默认 `@cf/meta/llama-3.2-11b-vision-instruct` |
| `POSTGRES_URL` | 否 | 历史记录 |
| `BLOB_READ_WRITE_TOKEN` | 否 | 成品图云存储 |

## 架构

```text
CLI / API / Web
  → lib/pipeline.ts（analyze → embed）
  → lib/ai.ts（Gemini、ModelScope 或 Cloudflare Workers AI）
  → lib/embed-metadata.ts（ExifTool 写英文元数据）
  → 可选 Neon + Blob
```

## 说明

- 写入图片的是**英文**元数据；中文仅在 JSON / UI 展示用
- 网页 `<img alt>` 不读取 EXIF；元数据供素材库、CMS 导入等场景
- 推荐 **JPEG**；PNG 元数据兼容性较弱

## 文档

| 文档 | 读者 | 内容 |
|------|------|------|
| [docs/integration-guide.md](docs/integration-guide.md) | 接入方 | CLI、API、curl 示例 |
| [docs/architecture.md](docs/architecture.md) | 开发者 | 模块、数据流、数据模型 |
| [docs/runbook.md](docs/runbook.md) | 运维 | 环境变量、冒烟、排障 |
| [docs/cloudflare-workers-ai.md](docs/cloudflare-workers-ai.md) | Cloudflare 接入 | Workers AI 配置、模型协议与本地测试 |
| [docs/handoff.md](docs/handoff.md) | 接手人 | 阶段进度与历史决策 |
| [docs/figma-design-system.md](docs/figma-design-system.md) | 前端 | 首页设计 token 参考 |
| [AGENTS.md](AGENTS.md) | AI Agent | 仓库约定与红线 |

**Legacy（勿按此实现）**：`docs/mvp-test-plan.md`、`docs/workflow-spec.md`、`n8n/`

## 遗留

- `/review` 旧审核 UI 清理
- Shopify Admin API 回写
- Amazon 多版本生成、云端历史与 SP-API 回写

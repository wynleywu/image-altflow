# Integration Guide

> 最后更新：2026-06-25  
> 面向：第一次接入 Image Altflow 的开发者（CLI 或 HTTP）。

## 前置条件

- Node.js 18+
- `GEMINI_API_KEY`（[Google AI Studio](https://aistudio.google.com/apikey)）
- 推荐图片格式：**JPEG**

## 方式一：CLI（最快）

```bash
git clone https://github.com/wynleywu/image-altflow.git
cd image-altflow
npm install
cp .env.example .env.local
# 编辑 .env.local，填入 GEMINI_API_KEY
```

### 一步：识图 + 写入 + 输出

```bash
npm run process -- ./product.jpg ./product-out.jpg
```

控制台打印双语 JSON；输出文件含英文元数据。

### 两步：先识图、手改、再写入

```bash
# 1. 仅识图，生成侧车 JSON
npm run process -- ./product.jpg --analyze-only
# 生成 ./product.jpg.ai.json

# 2. 编辑 JSON 后写入（以 JSON 内英文档为准）
npm run process -- ./product.jpg ./product-out.jpg --ai ./product.jpg.ai.json
```

### 验证元数据

需本机 [ExifTool](https://exiftool.org/)：

```bash
exiftool -G1 -a ./product-out.jpg
```

关注 `ImageDescription`、`Keywords` 等应为**英文**。

## 方式二：HTTP API

本地开发：

```bash
npm run dev
# 默认 http://localhost:3000
```

### Step 1 — Analyze

```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "image=@./product.jpg"
```

成功响应（节选）：

```json
{
  "ok": true,
  "ai": {
    "alt_text_en": "Wooden desk lamp on white background",
    "alt_text_zh": "白色背景上的木质台灯",
    "caption_en": "...",
    "caption_zh": "...",
    "tags_en": ["lamp", "wood"],
    "tags_zh": ["台灯", "木质"],
    "new_file_name": "wooden-desk-lamp.jpg",
    "confidence_note": "certain"
  },
  "originalImageBase64": "<base64>",
  "mimeType": "image/jpeg",
  "originalFileName": "product.jpg"
}
```

也支持 JSON body：`{ "image_url": "https://..." }`（公开可访问 URL）。

### Step 2 — Embed

将 Step 1 的 `originalImageBase64`、`mimeType` 与（可能编辑过的）`ai` 提交：

```bash
curl -X POST http://localhost:3000/api/embed \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "<from analyze>",
    "mimeType": "image/jpeg",
    "ai": { "new_file_name": "wooden-desk-lamp.jpg", "alt_text_en": "...", ... }
  }'
```

成功响应：

```json
{
  "ok": true,
  "download": {
    "fileName": "wooden-desk-lamp.jpg",
    "mimeType": "image/jpeg",
    "base64": "<processed image>"
  }
}
```

客户端将 `base64` 解码为文件即可。

## 错误码（`error_type`）

| 值 | 含义 |
|----|------|
| `missing_image` | 未提供图片文件或 URL |
| `ai_parse_error` | Gemini 返回非 JSON 或缺必填字段 |
| `analyze_failed` | 识图过程失败 |
| `invalid_ai_json` | embed 请求体 `ai` 无法解析 |
| `embed_failed` | ExifTool 写入失败 |
| `invalid_request` | embed 缺少必填字段 |

HTTP 状态：客户端错误 `400`，服务端/上游错误 `502`。

## 可选：云持久化

在 Vercel（或任意主机）配置：

| 变量 | 作用 |
|------|------|
| `POSTGRES_URL` | analyze 成功时可写 `image_records` |
| `BLOB_READ_WRITE_TOKEN` | 与 Postgres 同时配置时，embed 成品存 Blob |

仅 `GEMINI_API_KEY` 即可完成识图 + 元数据写入。

## 限制说明

- 浏览器 `<img alt="...">` **不会**读取文件内 EXIF Alt；元数据供桌面工具、素材库、部分 CMS 导入。
- Shopify 商品 Alt 通常需 **Admin API** 单独设置，不能仅靠文件元数据。
- 现有 Web 页面（`/`、`/review`）为旧版 UI，**未接上述 API**；请用 CLI 或自行调 API。

## Legacy 文档

以下描述飞书 / n8n 早期 MVP，**非当前接入方式**：

- `docs/mvp-test-plan.md`
- `docs/workflow-spec.md`

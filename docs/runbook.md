# Runbook

> 最后更新：2026-06-26

## 环境变量

| 变量 | 必填 | 来源 | 说明 |
|------|------|------|------|
| `AI_PROVIDER` | 否 | 手动 | `gemini` 或 `modelscope`；未设置默认 `modelscope` |
| `GEMINI_API_KEY` | `AI_PROVIDER=gemini` 时 | Google AI Studio | Gemini 识图 |
| `GEMINI_MODEL` | 否 | 手动 | 默认 `gemini-3.1-flash-lite` |
| `MODELSCOPE_API_KEY` | `AI_PROVIDER=modelscope` 或未设 provider 时 | ModelScope 控制台 | ModelScope 识图 |
| `MODELSCOPE_MODEL` | 否 | 手动 | 推荐 `Qwen/Qwen3-VL-30B-A3B-Instruct` |
| `POSTGRES_URL` | 否 | Vercel Neon / Neon 控制台 | 历史记录 |
| `BLOB_READ_WRITE_TOKEN` | 否 | Vercel Blob | 成品图 URL |

本地：复制 `.env.example` → `.env.local`。CLI 自动读取 `.env.local`。

## 常用命令

```bash
npm install
npm run dev          # 开发服务器 :3000
npm run build        # 生产构建（含类型检查）
npm run process -- ./in.jpg ./out.jpg
```

## 冒烟测试

### 1. 构建

```bash
npm run build
```

应无 TypeScript 错误。

### 2. CLI 全链路（需有效识图 API Key）

```bash
npm run process -- ./test.jpg ./test-out.jpg
exiftool -G1 -a ./test-out.jpg
```

### 3. API（需 `npm run dev`）

```bash
curl -s -X POST http://localhost:3000/api/analyze -F "image=@./test.jpg" | head -c 500
```

### 4. 生产 API（Vercel）

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST https://image-altflow.vercel.app/api/analyze \
  -F "image=@./test.jpg"
```

识图约 30–90 秒（ModelScope 30B + Serverless）。HTTP 200 且响应含 `"ok":true` 即通过。

## Vercel 部署

生产地址：**https://image-altflow.vercel.app**

1. Import GitHub 仓库
2. **Environment Variables**（Production + Preview 建议一致）：

| 变量 | 说明 |
|------|------|
| `AI_PROVIDER` | 推荐 `modelscope` |
| `MODELSCOPE_API_KEY` | 魔搭令牌 |
| `MODELSCOPE_MODEL` | 推荐 `Qwen/Qwen3-VL-30B-A3B-Instruct` |
| `GEMINI_API_KEY` | 可选，作 ModelScope 失败回退 |
| `GEMINI_MODEL` | 可选 |

3. （可选）Storage → Postgres、Blob
4. Deploy；**修改变量后需 Redeploy** 才生效

`exiftool-vendored` 在 Serverless 上包体较大；生产以 **API / Web** 为主路径，本地 CLI 仍适合批量与调试。

`next.config.ts` 已配置 `serverExternalPackages: ["exiftool-vendored"]`。

## 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| `GEMINI_API_KEY is not configured` | `AI_PROVIDER=gemini` 但未配 Key | 设置 `GEMINI_API_KEY` 或改 `AI_PROVIDER=modelscope` |
| `MODELSCOPE_API_KEY is not configured` | 默认 ModelScope 路径无 Key | 设置 `MODELSCOPE_API_KEY` 或 `AI_PROVIDER=gemini` |
| `ModelScope API error 400` | 模型未上架推理 | 换 `Qwen/Qwen3-VL-*`；勿用 `Qwen2.5-VL-72B` / `diffusiongemma` |
| `ModelScope API error 429` | 免费额度限流 | 降频重试；或 `AI_PROVIDER=gemini` |
| `ai_parse_error` | 模型返回非 JSON | 换图重试；检查 `GEMINI_MODEL` / `MODELSCOPE_MODEL` |
| `Corrupted JPEG` / embed 失败 | 输入非有效图片 | 换 JPEG；用 ExifTool 检查原图 |
| CLI 找不到模块 | 未 install | `npm install` |
| Caption 在 exiftool 中为空 | 工具字段名差异 | `ImageDescription` / `Keywords` 仍应存在 |
| 前端提交失败 | 批量 Tab 未实现或 `/review` 旧 UI | 使用首页单张流程、CLI 或 curl |

## 安全

- 公开部署的 `/api/analyze` 会消耗识图 API 额度（ModelScope / Gemini）；建议 Vercel **Password Protection**。
- 勿将 `.env.local` 提交到 Git（已在 `.gitignore`）。

## 日志

- 本地：CLI 直接 stdout/stderr
- Vercel：Dashboard → Functions → `/api/analyze` / `/api/embed`

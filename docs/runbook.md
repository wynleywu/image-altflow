# Runbook

> 最后更新：2026-07-10

## 环境变量

| 变量 | 必填 | 来源 | 说明 |
|------|------|------|------|
| `AI_PROVIDER` | 否 | 手动 | `gemini`、`modelscope` 或 `cloudflare`；未设置默认 `modelscope` |
| `GEMINI_API_KEY` | `AI_PROVIDER=gemini` 时 | Google AI Studio | Gemini 识图 |
| `GEMINI_MODEL` | 否 | 手动 | 默认 `gemini-3.1-flash-lite` |
| `MODELSCOPE_API_KEY` | `AI_PROVIDER=modelscope` 或未设 provider 时 | ModelScope 控制台 | ModelScope 识图 |
| `MODELSCOPE_MODEL` | 否 | 手动 | 推荐 `Qwen/Qwen3-VL-30B-A3B-Instruct` |
| `CLOUDFLARE_ACCOUNT_ID` | `AI_PROVIDER=cloudflare` 时 | Cloudflare Dashboard | Account ID |
| `CLOUDFLARE_API_TOKEN` | `AI_PROVIDER=cloudflare` 时 | Cloudflare Dashboard | Workers AI API Token |
| `CLOUDFLARE_MODEL` | 否 | 手动 | 默认 `@cf/meta/llama-3.2-11b-vision-instruct` |
| `POSTGRES_URL` | 否 | Vercel Neon / Neon 控制台 | 历史记录 |
| `BLOB_READ_WRITE_TOKEN` | 否 | Vercel Blob | 成品图 URL |
| `RECORDS_API_SECRET` | 使用 `/api/records*` 时 | 手动 | Bearer 鉴权；未配置则 records HTTP API 503 |

本地：复制 `.env.example` → `.env.local`。CLI 自动读取 `.env.local`。

## 常用命令

```bash
npm install
npm run dev          # 开发服务器 :3000
npm run build        # 生产构建（含类型检查）
npm test             # Provider 超时、Embed 边界、Amazon V2 与本地工作区测试
npm run cf:agree     # 默认 Meta 模型首次使用前接受协议
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

识图在 55 秒总预算内运行；单个视觉提供商最多分配 25 秒，超时后尝试已配置的备用提供商。HTTP 200 且响应含 `"ok":true` 即通过。

### 5. Amazon 审查工作台

1. 打开 `http://localhost:3000/amazon`，使用 ASIN 或手动 Listing 发起审查。
2. 确认跳转到 `/amazon/result?id=<auditId>`。
3. 编辑并确认标题，刷新页面；编辑稿与状态应恢复。
4. “最终 Listing”应显示未确认内容数，属性建议应保持“待核验”。

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
| `CLOUDFLARE_ACCOUNT_ID is not configured` | Cloudflare 配置缺失 | 检查 `.env.local` 中的 Account ID |
| `CLOUDFLARE_API_TOKEN is not configured` | Cloudflare 配置缺失 | 创建具有 Workers AI 权限的 Token 并写入 `.env.local` |
| Cloudflare 模型要求接受协议 | 默认 Meta 模型尚未授权 | 运行 `npm run cf:agree`；脚本会自动读取 `.env.local` |
| `ModelScope API error 400` | 模型未上架推理 | 换 `Qwen/Qwen3-VL-*`；勿用 `Qwen2.5-VL-72B` / `diffusiongemma` |
| `ModelScope API error 429` | 免费额度限流 | 降频重试；或 `AI_PROVIDER=gemini` |
| `ai_parse_error` | 模型连续返回不足 6 个可用字段 | Cloudflare 已逐字段解析并重试一次；Web 页面可点“重新分析”，仍失败时检查对应模型配置 |
| `invalid_base64` / `invalid_image` / `mime_mismatch` | Embed 图片编码、签名或声明 MIME 不一致 | 重新使用 analyze 返回的 Base64 与 MIME；不要手工改 MIME |
| `Corrupted JPEG` / embed 失败 | 原图或元数据段无效 | 换 JPEG；用 ExifTool 检查原图；确认 AI 字段未超过 API 限制 |
| CLI 找不到模块 | 未 install | `npm install` |
| Caption 在 exiftool 中为空 | 工具字段名差异 | `ImageDescription` / `Keywords` 仍应存在 |
| Amazon 结果提示无法恢复 | URL 缺少/包含失效 `auditId`，或浏览器 localStorage 被清理 | 返回 `/amazon` 重新审查；工作区仅保存在当前浏览器 |
| Amazon 建议缺少 V2 字段 | 上游模型返回旧结构或部分字段 | `normalize-audit.ts` 会补默认值；检查服务端日志与 Prompt 输出 |
| 前端提交失败 | API Key 或网络问题 | 使用首页流程、`/amazon`、CLI 或 curl；数据库记录管理使用带 Bearer 鉴权的 `/api/records*` |

## 安全

- 公开部署的 `/api/analyze`、`/api/embed`、`/api/amazon/audit` 会消耗识图 / LLM 额度。生产环境应配置 **Upstash Redis**（`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`）启用 IP 限流：
  - analyze：30 次 / 10 分钟
  - embed：40 次 / 10 分钟
  - amazon audit：10 次 / 10 分钟
  - 超限返回 `429` + `error_type: rate_limited` + `Retry-After`
  - 未配置 Upstash 时限流跳过（本地开发 fail-open）
- 可选额外加固：Vercel **Password Protection**。
- 勿将 `.env.local` 提交到 Git（已在 `.gitignore`）。

## 日志

- 本地：CLI 直接 stdout/stderr
- Vercel：Dashboard → Functions → `/api/analyze` / `/api/embed` / `/api/amazon/audit`

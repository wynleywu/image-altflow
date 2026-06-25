# Runbook

> 最后更新：2026-06-25

## 环境变量

| 变量 | 必填 | 来源 | 说明 |
|------|------|------|------|
| `GEMINI_API_KEY` | **是** | Google AI Studio | 识图 |
| `GEMINI_MODEL` | 否 | 手动 | 默认 `gemini-2.0-flash-lite` |
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

### 2. CLI 全链路（需有效 `GEMINI_API_KEY`）

```bash
npm run process -- ./test.jpg ./test-out.jpg
exiftool -G1 -a ./test-out.jpg
```

### 3. API（需 `npm run dev`）

```bash
curl -s -X POST http://localhost:3000/api/analyze -F "image=@./test.jpg" | head -c 500
```

## Vercel 部署（阶段二前可选）

1. Import GitHub 仓库
2. 设置 `GEMINI_API_KEY`
3. （可选）Storage → Postgres、Blob
4. Deploy

注意：`exiftool-vendored` 在 Serverless 上包体较大；阶段一以**本地 CLI** 为主验证手段。

`next.config.ts` 已配置 `serverExternalPackages: ["exiftool-vendored"]`。

## 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| `GEMINI_API_KEY is not configured` | 未配置 env | 检查 `.env.local` 或 Vercel 环境变量 |
| `ai_parse_error` | 模型返回非 JSON | 换图重试；检查 `GEMINI_MODEL` |
| `Corrupted JPEG` / embed 失败 | 输入非有效图片 | 换 JPEG；用 ExifTool 检查原图 |
| CLI 找不到模块 | 未 install | `npm install` |
| Caption 在 exiftool 中为空 | 工具字段名差异 | `ImageDescription` / `Keywords` 仍应存在 |
| 前端提交失败 | 旧 UI 未接新 API | 使用 CLI 或 curl，见 `integration-guide.md` |

## 安全

- 公开部署的 `/api/analyze` 会消耗 Gemini 额度；个人使用建议 Vercel Password Protection。
- 勿将 `.env.local` 提交到 Git（已在 `.gitignore`）。

## 日志

- 本地：CLI 直接 stdout/stderr
- Vercel：Dashboard → Functions → `/api/analyze` / `/api/embed`

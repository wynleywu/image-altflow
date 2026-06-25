# Image Altflow

AI 图片 SEO 助手：提交图片链接 → Gemini 识图 → 生成文件名 / Alt Text / Caption / Tags → 飞书多维表格审核。

Web 版替代 n8n MVP，可直接部署到 [Vercel](https://vercel.com)。

## 功能

- 提交公开图片 URL，调用 Gemini 生成结构化 SEO 文案
- 结果写入飞书多维表格
- 网页内审核：修改文件名、Alt Text、Caption、审核状态

## 本地开发

```bash
npm install
cp .env.example .env.local
# 编辑 .env.local，填入 GEMINI_API_KEY、FEISHU_APP_ID、FEISHU_APP_SECRET
npm run dev
```

打开 http://localhost:3000

## Vercel 部署

1. 将仓库导入 Vercel（Framework Preset: **Next.js**）
2. 在 **Project → Settings → Environment Variables** 配置：

| 变量 | 说明 |
|------|------|
| `GEMINI_API_KEY` | Google AI Studio API Key |
| `GEMINI_MODEL` | 可选，默认 `gemini-2.0-flash-lite` |
| `FEISHU_APP_ID` | 飞书自建应用 App ID |
| `FEISHU_APP_SECRET` | 飞书自建应用 App Secret |
| `FEISHU_BITABLE_APP_TOKEN` | 多维表格 app_token |
| `FEISHU_BITABLE_TABLE_ID` | 数据表 table_id |

3. Deploy

## 飞书权限

应用需开通 `bitable:app`，并将应用加入多维表格协作者（可编辑）。

当前表：`JJzAbQKKTarYg9skHMbc05Iunzd` / `tblhUhdCX1s6C4Ny`

## 文档

- [MVP 测试计划](docs/mvp-test-plan.md)
- [流程实施说明](docs/workflow-spec.md)

## 遗留

- n8n 工作流源码保留在 `n8n/`，可不再使用
- 本地图片上传、Shopify 回写、群通知尚未实现

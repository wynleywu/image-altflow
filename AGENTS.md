# Image Altflow — Agent 指南

> 最后对齐：2026-07-25。全局行为见用户级 AGENTS/CLAUDE；**勿重复全局硬规则**。  
> 进度与历史决策：[`docs/handoff.md`](./docs/handoff.md)。按需地图：[`docs/agent/`](./docs/agent/README.md)。

**产品：** 双语识图 + 英文 SEO 元数据写入图片（CLI / Web / API）；Amazon Listing 审查工作台在 `/amazon`。

**栈：** Next.js 15 App Router · Gemini / ModelScope / Cloudflare Workers AI · `exiftool-vendored` · 可选 Neon + Blob。

## 命令与端口

```bash
npm run dev              # 默认 :3040（scripts/dev.mjs）；PORT 可覆盖
npm run process -- ./input.jpg ./output.jpg
npm run process -- ./input.jpg --analyze-only
npm run process -- ./input.jpg ./output.jpg --ai ./input.ai.json
npm run build
npm test
```

worktree 并行：`$env:PORT = 3041; npm run dev`。工作区总表：上级 `PORTS.md`。

## 本地预览（Orca）

默认 Orca 内置浏览器；禁止系统浏览器打开预览。

```bash
orca tab create --url http://localhost:3040 --json
orca goto --url http://localhost:3040 --json
orca file open --path docs/handoff.md --json
```

## 核心流程（速记）

```text
analyze → lib/ai.ts → 双语 JSON
embed   → 仅 _en 字段写入 EXIF/XMP/IPTC
```

编排：`lib/pipeline.ts`（CLI 与 API 共用）。路由 / env / 文件表 → [`docs/agent/api-and-env.md`](./docs/agent/api-and-env.md)。

## 红线

- 写入图片元数据**只用英文字段**（`alt_text_en` 等）
- 首页单张/批量：编排在 `app/page.tsx` + `app/_components/home/`；勿随意改批量流程，除非用户明确要求
- 不要恢复飞书依赖；`lib/feishu.ts` 已删除
- Amazon 规则必须区分「已确认规则」和「优化建议」；不得把类目建议写成平台违规结论
- Legacy：`docs/mvp-test-plan.md`、`docs/workflow-spec.md`、`n8n/` 勿按其实现

## 能力边界（vs tools-jinqing）

| 能力 | 落点 |
|------|------|
| 图片 SEO 元数据（识图 + EXIF） | **本仓** |
| Amazon Listing **审查**（规则/证据/可编辑稿） | **本仓** `/amazon` |
| Amazon **卖点/关键词洞察** | **tools-jinqing** `/tools/amazon-insights` |

## 按需文档

| 文档 | 用途 |
|------|------|
| [`docs/agent/api-and-env.md`](./docs/agent/api-and-env.md) | 路由 / env / 关键文件 |
| [`docs/handoff.md`](./docs/handoff.md) | 进度与决策 |
| [`docs/architecture.md`](./docs/architecture.md) | 架构 |
| [`docs/integration-guide.md`](./docs/integration-guide.md) | HTTP 接入 |
| [`docs/runbook.md`](./docs/runbook.md) | 运维 |

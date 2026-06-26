# Handoff & Changelog

> 最后更新：2026-06-26

## 当前状态

| 能力 | 状态 |
|------|------|
| 双语识图（`_en` / `_zh`） | 完成（Gemini + ModelScope，`lib/ai.ts`） |
| 英文元数据写入图片（ExifTool） | 完成 |
| 本地 CLI `npm run process` | 完成 |
| `POST /api/analyze` | 完成 |
| `POST /api/embed` | 完成 |
| 可选 Neon + Blob 持久化 | 完成 |
| Vercel 生产部署 | 完成（2026-06-26，`image-altflow.vercel.app`） |
| Web UI 单张流程（`app/page.tsx`） | 完成（2026-06-25） |
| Web UI 批量 Tab | 占位 |
| `/review` 旧审核 UI | 未清理 |
| Shopify 回写 | 未开始 |

## 推荐使用方式（2026-06-26）

CLI：

```bash
cp .env.example .env.local   # AI_PROVIDER + 对应 Key
npm run process -- ./input.jpg ./output.jpg
```

Web：`npm run dev` → `http://localhost:3000/`；生产 → **https://image-altflow.vercel.app/**
需要改文案时（CLI）：`--analyze-only` → 编辑 `*.ai.json` → `--ai`。

## 阶段二待办

- [ ] 批量上传（首页 Batch Tab）
- [ ] 移除或隐藏 `/review` 旧审核流 UI
- [ ] Vercel Password Protection（若公开部署）

## 历史决策

| 日期 | 决策 |
|------|------|
| 2026-06-26 | Vercel 生产部署；识图主路径 `AI_PROVIDER=modelscope` + `Qwen/Qwen3-VL-30B-A3B-Instruct` |
| 2026-06-26 | 识图支持 ModelScope；`lib/ai.ts` 统一路由，默认 ModelScope、失败可回退 Gemini |
| 2026-06-25 | 首页单张流程 UI 落地，接 analyze/embed API |
| 2026-06 | 放弃飞书多维表格（bot 写表权限 91403） |
| 2026-06 | 存储改为自有 Neon + Blob（可选） |
| 2026-06 | 产品定位：单用户、元数据写入图片、非审批流 |
| 2026-06 | 阶段一不做前端，先 CLI/API |

## Legacy 资产

- `docs/mvp-test-plan.md` — n8n + 飞书测试计划
- `docs/workflow-spec.md` — 飞书审核流程 spec
- `n8n/` — 云工作流 JSON/脚本存档

勿按 Legacy 文档实现新功能。

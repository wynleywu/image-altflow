# Handoff & Changelog

> 最后更新：2026-06-25

## 当前状态（阶段一完成）

| 能力 | 状态 |
|------|------|
| 双语 Gemini 识图（`_en` / `_zh`） | 完成 |
| 英文元数据写入图片（ExifTool） | 完成 |
| 本地 CLI `npm run process` | 完成 |
| `POST /api/analyze` | 完成 |
| `POST /api/embed` | 完成 |
| 可选 Neon + Blob 持久化 | 完成 |
| Web UI（中英对照、两步按钮） | **单张流程已完成**（2026-06-25）；批量 Tab 占位 |
| Shopify 回写 | 未开始 |

## 推荐使用方式（2026-06-25）

单用户、用完即走：

```bash
cp .env.example .env.local   # GEMINI_API_KEY
npm run process -- ./input.jpg ./output.jpg
```

需要改文案时：`--analyze-only` → 编辑 `*.ai.json` → `--ai`。

## 阶段二待办（设计稿到位后）

- [ ] `app/page.tsx`：上传、中英对照编辑、「写入并下载」
- [ ] `app/layout.tsx`：导航与品牌
- [ ] 移除或隐藏旧审核流 UI
- [ ] Vercel 部署与 Password Protection（若公开）

## 历史决策

| 日期 | 决策 |
|------|------|
| 2026-06 | 放弃飞书多维表格（bot 写表权限 91403） |
| 2026-06 | 存储改为自有 Neon + Blob（可选） |
| 2026-06 | 产品定位：单用户、元数据写入图片、非审批流 |
| 2026-06 | 阶段一不做前端，先 CLI/API |

## Legacy 资产

- `docs/mvp-test-plan.md` — n8n + 飞书测试计划
- `docs/workflow-spec.md` — 飞书审核流程 spec
- `n8n/` — 云工作流 JSON/脚本存档

勿按 Legacy 文档实现新功能。

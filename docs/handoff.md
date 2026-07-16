# Handoff & Changelog

> 最后更新：2026-07-10

## 当前状态

| 能力 | 状态 |
|------|------|
| 双语识图（`_en` / `_zh`） | 完成（Gemini + ModelScope + Cloudflare，`lib/ai.ts`） |
| 英文元数据写入图片（ExifTool） | 完成 |
| 本地 CLI `npm run process` | 完成 |
| `POST /api/analyze` | 完成 |
| `POST /api/embed` | 完成 |
| Provider 超时与回退预算 | 完成（2026-07-10，视觉链路 55 秒总预算；Amazon 文本单提供商 20 秒） |
| Embed 运行时输入校验 | 完成（2026-07-10，Base64、图片签名/MIME、AI 字段与 JPEG 段长度） |
| 可选 Neon + Blob 持久化 | 完成 |
| Vercel 生产部署 | 完成（2026-06-26，`image-altflow.vercel.app`） |
| Web UI 单张流程（`app/page.tsx` + `app/_components/home/*`） | 完成（2026-06-25；2026-07-12 拆分巨石 page） |
| Web UI 批量流程 | 完成（2026-07-01，串行处理 + 重试 + ZIP 下载） |
| Amazon Listing 审查 (`/amazon`) | 完成 V2 首批闭环（2026-07-01，诊断证据 + 编辑确认 + 最终稿 + localStorage） |
| `/review` 旧审核 UI | 已下线（2026-07-10） |
| Shopify 回写 | 未开始 |

## 推荐使用方式（2026-06-26）

CLI：

```bash
cp .env.example .env.local   # AI_PROVIDER + 对应 Key
npm run process -- ./input.jpg ./output.jpg
```

Web：`npm run dev` → `http://localhost:3040/`（`PORT` 可覆盖）；生产 → **https://image-altflow.vercel.app/**
需要改文案时（CLI）：`--analyze-only` → 编辑 `*.ai.json` → `--ai`。

## 阶段二待办

- [x] 公开 API IP 限流（Upstash；未配置则跳过）
- [x] 首页 UI 拆分（`app/page.tsx` + `app/_components/home/*`，2026-07-12）
- [ ] Vercel Password Protection（可选额外加固；公开 API 已有 Upstash 时后置）
- [ ] Amazon 审查：多策略版本、单章节重新生成、云端历史、Sanity/SP-API（产品 backlog，未排期）

## 与 tools-jinqing 的能力边界

| 能力 | 主落点 | 说明 |
|------|--------|------|
| 图片 SEO 元数据（识图 + EXIF） | **本仓** `image-altflow`（alt.jinqing.cc） | 单张/批量 + CLI |
| Amazon **Listing 审查**（规则/证据/可编辑最终稿） | **本仓** `/amazon` | V2 工作台，localStorage |
| Amazon **卖点/关键词洞察**（抓取 + 卖点结构化） | **tools-jinqing** `/tools/amazon-insights` | 轻量选品分析，不替代 Listing 审查 |

勿在 tools 再扩深度合规审查；勿在本仓重做卖点抓取工作台。交叉入口：tools 目录链到 altflow；本仓 mode tab 链到 `/amazon`。

## 历史决策

| 日期 | 决策 |
|------|------|
| 2026-07-10 | 公开 analyze/embed/amazon audit 采用无登录 IP 限流（Upstash sliding window）；本地无 env 时 fail-open |
| 2026-07-10 | 下线 Legacy `/review` Server Actions；数据库记录 HTTP 管理仅保留带 Bearer 鉴权的 `/api/records*` |
| 2026-07-10 | 视觉提供商共享 55 秒总预算；Embed 在元数据写入前执行严格运行时校验 |
| 2026-07-01 | Amazon 审查升级为 V2：规则与建议分级，结果按 `auditId` 保存在浏览器，属性建议不自动进入最终稿 |
| 2026-06-27 | 新增 Cloudflare Workers AI REST 提供商；三个提供商共用 `lib/prompt.ts`，默认 Cloudflare 模型为 Llama 3.2 11B Vision |
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

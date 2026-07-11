# Image Altflow 流程实施说明

> **Legacy（2026-06-25）** — 本文档描述 **n8n + 飞书多维表格 + 人工审核** 的早期 MVP，**不是当前实现**。  
> 当前方案见：[integration-guide.md](./integration-guide.md) · [architecture.md](./architecture.md)

---

## 1. 目标

把当前 MVP 收敛成一条可以直接在 n8n 中搭建、测试、复盘的最小闭环：

```text
图片链接输入
-> 输入校验
-> Gemini 识图并生成结构化文案
-> 结果规范化
-> 写入飞书多维表格
-> 发送飞书群通知
-> 人工审核
```

这份文档不讨论 Shopify、站点回写和批量发布，只定义第一阶段必须跑通的流程。

## 2. 流程边界

### 包含

- 接收公开可访问图片链接
- 调用 Gemini 产出结构化 JSON
- 对 AI 结果做字段补全和异常标记
- 写入飞书多维表格作为审核台
- 通过飞书群提醒人工审核

### 不包含

- 上传本地图片到对象存储
- 自动重命名原始文件
- 自动写回 Shopify 或网站 CMS
- 审核通过后的自动发布

## 3. 记录状态设计

建议在飞书表中新增或明确以下状态字段。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| 流程状态 | 单选 | `pending` / `running` / `success` / `failed` |
| 审核状态 | 单选 | `待审核` / `通过` / `退回` |
| 异常类型 | 文本 | 例如 `invalid_image_url`、`ai_parse_error` |
| 异常说明 | 多行文本 | 存放失败原因，便于复盘 |
| 重试次数 | 数字 | 记录当前记录被自动重试了几次 |

说明：

- `流程状态` 用于技术链路观测。
- `审核状态` 用于业务人工判断。
- 只有 `流程状态 = success` 的记录，才应该进入人工审核视图。

## 4. 节点级实施流程

### 节点 1：Webhook 接收输入

输入示例：

```json
{
  "image_url": "https://example.com/test-image.jpg",
  "original_file_name": "IMG_001.jpg",
  "source": "manual",
  "trace_id": "img-20260625-0001"
}
```

要求：

- `image_url` 必填
- `original_file_name` 建议传入，缺失时可从 URL 最后一段推导
- `trace_id` 建议由调用方生成；若没有，则由 n8n 生成

输出字段：

```json
{
  "image_url": "...",
  "original_file_name": "...",
  "source": "manual",
  "trace_id": "...",
  "received_at": "2026-06-25T15:00:00+08:00"
}
```

### 节点 2：输入校验

校验内容：

- 图片链接是否存在
- 链接是否为 `http` 或 `https`
- 文件名是否可解析

处理规则：

- 校验通过：进入下一步
- 校验失败：直接写飞书失败记录，`流程状态 = failed`

推荐异常码：

```text
invalid_payload
missing_image_url
invalid_image_url
```

### 节点 3：AI 识图与文案生成

模型：

```text
gemini-3.5-flash
```

输入：

- 图片 URL
- 产品类目背景
- 固定 JSON 输出要求

输出目标：

```json
{
  "image_description": "string",
  "new_file_name": "string",
  "alt_text": "string",
  "caption": "string",
  "tags": ["string"],
  "product_type": "string",
  "main_color": "string",
  "scene": "string",
  "confidence_note": "certain | uncertain"
}
```

补充约束：

- `new_file_name` 全小写，使用 `-` 连接
- 保留原始扩展名，默认 `.jpg`
- `alt_text` 以客观描述为主，避免营销词
- 识别不确定时，`confidence_note` 输出 `uncertain`

### 节点 4：JSON 解析与结果规范化

处理内容：

- 解析模型输出 JSON
- 将 `tags` 数组转成飞书可接受的格式
- 检查关键字段是否缺失
- 为缺失字段填默认值或标记异常

关键字段：

```text
image_description
new_file_name
alt_text
caption
product_type
main_color
scene
```

处理规则：

- 全部存在：`流程状态 = success`
- 部分缺失但可人工审核：`流程状态 = success`，同时标记 `异常类型 = partial_ai_result`
- 无法解析 JSON：`流程状态 = failed`

推荐默认值策略：

- `caption` 缺失时，回退为 `alt_text`
- `tags` 缺失时，写入空数组或空文本
- `main_color` / `scene` 不确定时写 `uncertain`

### 节点 5：写入飞书多维表格

建议写入以下字段：

| 飞书字段 | 来源 |
| --- | --- |
| 原文件名 | `original_file_name` |
| 图片链接 | `image_url` |
| 图片预览 | `image_url` |
| AI 识别描述 | `image_description` |
| 新文件名 | `new_file_name` |
| Alt Text | `alt_text` |
| Caption | `caption` |
| Tags | `tags` |
| 产品类型 | `product_type` |
| 主体颜色 | `main_color` |
| 使用场景 | `scene` |
| 流程状态 | `success` / `failed` |
| 审核状态 | 成功时默认 `待审核` |
| 异常类型 | 异常码 |
| 异常说明 | 失败原因 |
| 重试次数 | 自动累计 |
| 创建时间 | 当前时间 |
| Trace ID | `trace_id` |

要求：

- 无论成功失败，都尽量落一条记录，方便复盘
- `Trace ID` 必须保留，后续查问题会非常省时间

### 节点 6：飞书群通知

只对以下记录发通知：

- `流程状态 = success`
- `审核状态 = 待审核`

消息建议包含：

```text
有新图片待审核
原文件名：{{original_file_name}}
建议文件名：{{new_file_name}}
Alt Text：{{alt_text}}
Trace ID：{{trace_id}}
```

失败记录不进群提醒，避免噪音。

### 节点 7：人工审核

人工只做三个动作：

1. 修改 `新文件名`
2. 修改 `Alt Text` / `Caption`
3. 更新 `审核状态`

建议审核视图：

- `待审核`
- `已通过`
- `已退回`
- `流程失败`

## 5. 异常分支

### 图片不可访问

表现：

- AI 节点无法抓取图片

处理：

- 写飞书失败记录
- `异常类型 = image_fetch_failed`
- 不发群通知

### AI 输出不是 JSON

表现：

- 返回纯文本或 JSON 结构损坏

处理：

- 自动重试 1 次
- 仍失败则写飞书失败记录
- `异常类型 = ai_parse_error`

### 飞书写入失败

表现：

- token 失效
- 权限不足
- 表字段不匹配

处理：

- 自动重试 1 到 2 次
- 失败后终止流程并记录运行日志
- 这类错误优先修系统，不建议静默吞掉

### 通知发送失败

表现：

- 飞书群机器人接口异常

处理：

- 不影响主记录成功写入
- 在 n8n 执行日志中标记 `notify_failed`

## 6. 最小可执行搭建顺序

建议按下面顺序逐步验证，不要一次性全接。

1. 只打通 Webhook -> Set -> 日志输出
2. 接 Gemini，确认稳定返回 JSON
3. 接 JSON 解析，跑通字段校验
4. 单独验证飞书表格写入
5. 最后再补飞书群通知

这样做的好处是每次只新增一个变量，定位问题更快。

## 7. 验收口径

第一阶段判定“流程可用”，至少满足下面条件：

- 连续 20 张图片测试中，大部分记录能成功落表
- 至少 80% 的 `Alt Text` 可直接使用或轻微修改后使用
- 审核人员能仅通过飞书表快速筛出通过与退回项
- 出错记录可以通过 `Trace ID + 异常类型` 快速定位

## 8. 下一步建议

当前这套流程跑稳后，再继续补下面三件事最合适：

1. 文件名去重策略
2. 审核通过后的导出 CSV
3. 审核结果回写到对象存储或 Shopify

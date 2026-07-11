# n8n + 飞书图片识别 MVP 测试计划

> **Legacy（2026-06-25）** — 本文档描述 **n8n + 飞书** 测试计划，**不是当前实现**。  
> 当前接入方式见：[integration-guide.md](./integration-guide.md)

---

## 一、测试目标

验证 n8n 是否可以完成以下流程：

```text
图片上传 / 图片链接输入
↓
n8n 自动触发
↓
gemini-3.5-flash 识别图片内容
↓
生成文件名、Alt Text、Caption、Tags
↓
写入飞书多维表格
↓
飞书群通知审核
```

第一阶段只测试“生成 + 写入 + 通知”，暂时不做自动改文件名，也不直接写回 Shopify 或网站。

## 二、测试范围

本次测试只做 4 件事：

1. 图片能进入 n8n 流程
2. AI 能识别图片内容
3. 结果能写入飞书多维表格
4. 飞书群能收到审核提醒

暂不测试：

- 自动重命名原图
- 自动上传到 Shopify
- 自动写入网站 Alt Text
- 多人权限系统
- 批量发布

## 三、推荐测试架构

```text
图片来源
↓
n8n Webhook / 手动上传 / Google Drive
↓
AI 视觉模型
↓
结构化结果处理
↓
飞书多维表格
↓
飞书群通知
```

建议第一版使用“图片链接”测试，不要一开始处理复杂的本地文件上传。

## 四、飞书多维表格字段设计

新建一个飞书多维表格，表名建议为：

```text
AI 图片识别测试表
```

字段建议如下：

| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| 原文件名 | 文本 | 原始图片名称 |
| 图片链接 | URL / 文本 | 图片地址 |
| 图片预览 | 附件 / URL | 用于人工查看 |
| AI 识别描述 | 多行文本 | AI 对画面的完整描述 |
| 新文件名 | 文本 | SEO 友好的英文文件名 |
| Alt Text | 多行文本 | 图片 Alt Text |
| Caption | 文本 | 简短说明 |
| Tags | 多选 / 文本 | 关键词标签 |
| 产品类型 | 文本 | 例如 `bathtub safety seat` |
| 主体颜色 | 文本 | 例如 `gray` |
| 使用场景 | 文本 | 例如 `modern bathroom` |
| 审核状态 | 单选 | 待审核 / 通过 / 退回 |
| 人工备注 | 多行文本 | 修改意见 |
| 创建时间 | 日期 | 自动记录 |

## 五、AI 输出格式

让 AI 固定输出 JSON，方便 n8n 后续解析。

```json
{
  "original_file_name": "IMG_001.jpg",
  "image_description": "A gray bathtub safety seat with armrest placed beside a modern freestanding bathtub.",
  "new_file_name": "gray-bathtub-safety-seat-with-armrest-modern-bathroom.jpg",
  "alt_text": "Gray bathtub safety seat with armrest placed beside a modern freestanding bathtub.",
  "caption": "Bathroom safety seat with armrest for elderly bathing support.",
  "tags": ["bathroom safety", "elderly care", "bathtub seat", "armrest", "gray"],
  "product_type": "bathtub safety seat",
  "main_color": "gray",
  "scene": "modern bathroom"
}
```

## 六、n8n 工作流节点设计

### 1. Webhook Trigger

作用：接收测试图片链接。

输入内容：

```json
{
  "image_url": "https://example.com/test-image.jpg",
  "original_file_name": "IMG_001.jpg"
}
```

### 2. Set / Edit Fields

作用：整理输入字段。

保留字段：

```text
image_url
original_file_name
source
created_at
```

### 3. AI Vision 节点

作用：使用 `gemini-3.5-flash` 多模态模型识别图片内容，并生成结构化文案。

推荐模型：

```text
gemini-3.5-flash
```

Prompt 建议：

```text
你是一名跨境电商图片 SEO 助手。

请识别这张产品图片，并生成适合 Shopify、独立站和素材库使用的信息。

要求：
1. 文件名使用英文小写
2. 单词之间用短横线连接
3. 文件名不要超过 12 个单词
4. Alt Text 自然描述画面，不要堆关键词
5. 不要编造图片中没有出现的功能
6. 如果无法确认材质、品牌、型号，不要写
7. 输出必须是 JSON

请输出：
- image_description
- new_file_name
- alt_text
- caption
- tags
- product_type
- main_color
- scene
```

### 4. JSON Parse / Code 节点

作用：解析 AI 返回结果。

检查字段是否完整：

```text
new_file_name
alt_text
caption
tags
product_type
main_color
scene
```

如果缺少关键字段，则标记为“AI 结果异常”。

### 5. 飞书 Token 节点

作用：获取飞书 API 调用所需 token。

需要准备：

```text
App ID
App Secret
飞书应用权限
多维表格 app_token
table_id
```

### 6. HTTP Request：写入飞书多维表格

作用：把 AI 生成结果写入飞书表格。

写入字段：

```text
原文件名
图片链接
AI 识别描述
新文件名
Alt Text
Caption
Tags
产品类型
主体颜色
使用场景
审核状态 = 待审核
创建时间
```

### 7. HTTP Request：发送飞书群通知

作用：提醒有新图片需要审核。

通知内容建议：

```text
有一张新图片已完成 AI 识别，请审核。

原文件名：IMG_001.jpg
建议文件名：gray-bathtub-safety-seat-with-armrest-modern-bathroom.jpg
Alt Text：Gray bathtub safety seat with armrest placed beside a modern freestanding bathtub.

状态：待审核
```

## 六点五、建议补充的流程控制

为了让这条链路后面更容易排错，建议在第一版就补上下面 4 个控制点：

### 1. 统一 Trace ID

每次请求都带一个 `trace_id`，并在 n8n 执行日志、飞书表格、飞书通知里都保留。

建议格式：

```text
img-20260625-0001
```

这样后面看到一条异常记录时，可以直接反查整条执行链路。

### 2. 区分“流程状态”和“审核状态”

不要只保留一个“审核状态”字段。

建议拆成：

- `流程状态`：`pending / running / success / failed`
- `审核状态`：`待审核 / 通过 / 退回`

这样可以分清楚：

- 是系统没跑通
- 还是 AI 跑通了，但人工觉得结果不可用

### 3. 失败记录也落飞书

不要只写成功记录。

失败记录至少保留这些字段：

```text
原文件名
图片链接
流程状态
异常类型
异常说明
Trace ID
创建时间
```

这样复盘时不会只看到“成功案例”。

### 4. 只对成功记录发审核通知

发群提醒前加一个判断：

```text
流程状态 = success
且 审核状态 = 待审核
```

否则失败任务也推到群里，会很快让通知失去价值。

## 七、测试步骤

### 第 1 步：准备飞书环境

完成事项：

```text
创建飞书自建应用
开通多维表格相关权限
创建测试多维表格
获取 app_token 和 table_id
配置群机器人或消息发送权限
```

验收标准：

```text
可以手动通过 API 写入一条测试记录
```

### 第 2 步：准备 n8n 流程

完成事项：

```text
创建 n8n workflow
添加 Webhook Trigger
添加 Gemini AI Vision 节点，模型使用 gemini-3.5-flash
添加 JSON 解析节点
添加飞书写入节点
添加飞书通知节点
```

验收标准：

```text
n8n 执行一次流程不报错
```

### 第 3 步：单张图片测试

测试图片建议准备 5 张：

```text
1. 产品白底图
2. 产品场景图
3. 产品细节图
4. 有人物使用的场景图
5. AI 容易误判的复杂图片
```

验收标准：

```text
图片内容识别基本正确
文件名可用
Alt Text 自然
飞书表格正常新增记录
飞书群正常收到通知
```

### 第 4 步：小批量测试

一次测试 20 张图片。

记录以下指标：

```text
识别成功率
字段完整率
文件名可用率
Alt Text 可用率
误判类型
平均处理时间
是否有重复文件名
是否有 API 报错
```

验收标准：

```text
80% 以上结果可直接使用或轻微修改后使用
```

### 第 5 步：审核流程测试

在飞书多维表格中测试三种状态：

```text
待审核
通过
退回
```

第一阶段只手动改状态，不触发后续自动写回。

验收标准：

```text
可以在飞书里清楚判断哪些图片可用，哪些需要修改
```

## 八、测试验收标准

测试成功的标准：

```text
1. n8n 可以稳定接收图片链接
2. gemini-3.5-flash 可以生成结构化结果
3. 结果可以写入飞书多维表格
4. 飞书群可以收到提醒
5. 生成的 Alt Text 不严重误导
6. 生成的文件名符合 SEO 命名规则
7. 人工审核流程顺畅
```

不要求第一版做到：

```text
完全自动
零错误
直接发布
自动改原文件
多平台同步
```

## 九、风险点

### 1. AI 误判产品

例如把“浴缸辅助座椅”识别成“普通椅子”。

解决方式：

```text
在 Prompt 里加入产品类目背景
让 AI 不确定时输出 uncertain
保留人工审核
```

### 2. 文件名重复

多张类似图片可能生成相同文件名。

解决方式：

```text
文件名后面追加 SKU 或序号
例如：
gray-bathtub-safety-seat-armrest-001.jpg
```

### 3. Alt Text 过度营销

Alt Text 不应该像广告语。

错误示例：

```text
Best gray bathtub safety seat for elderly people, high quality and comfortable.
```

更好示例：

```text
Gray bathtub safety seat with armrest placed beside a modern bathtub.
```

### 4. 飞书 API 权限配置复杂

第一次接飞书开放平台，最容易卡在权限和 token。

解决方式：

```text
先只测试写入一条表格记录
不要一开始就同时做图片上传、群消息和表格写入
```

### 5. 图片来源不稳定

如果图片链接需要登录、过期或防盗链，AI 可能无法读取。

解决方式：

```text
先使用公开可访问图片链接
后续再接对象存储或飞书附件
```

## 十、阶段安排

### 第 1 天：飞书环境准备

目标：

```text
飞书应用创建完成
多维表格创建完成
API 写入测试成功
```

输出物：

```text
飞书 App ID / App Secret
app_token
table_id
测试表字段
```

### 第 2 天：n8n 主流程搭建

目标：

```text
Webhook 可以接收图片链接
gemini-3.5-flash 可以返回 JSON
n8n 可以解析结果
```

输出物：

```text
n8n 测试 workflow
AI Prompt 初版
JSON 输出模板
```

### 第 3 天：写入飞书 + 群通知

目标：

```text
AI 结果写入飞书表格
飞书群收到审核提醒
```

输出物：

```text
完整 MVP 流程
飞书审核表
飞书通知模板
```

### 第 4 天：20 张图片测试

目标：

```text
测试稳定性和识别准确率
```

输出物：

```text
测试记录
错误案例
Prompt 优化建议
字段优化建议
```

### 第 5 天：复盘与下一步决策

目标：

```text
判断是否进入第二阶段
```

复盘问题：

```text
gemini-3.5-flash 识别是否足够准？
Alt Text 是否可用？
飞书审核是否顺手？
是否需要网站前台？
是否需要接 Shopify？
是否需要批量上传？
```

## 十一、下一阶段规划

如果 MVP 测试通过，第二阶段再做：

```text
1. 批量上传图片
2. 自动检测重复文件名
3. 审核通过后自动生成最终文件名
4. 导出 CSV
5. 接 Shopify 图片 Alt Text
6. 接网站后台
7. 做一个轻量图片管理网站
```

## 十二、最终判断

第一阶段的核心不是追求自动化程度，而是验证这条链路是否成立：

```text
AI 能不能看懂你的产品图
↓
生成的文件名和 Alt Text 是否可用
↓
飞书能不能成为顺手的审核台
```

只要这三件事跑通，就值得进入网站化或 Shopify 自动同步阶段。

## 参考资料

- [n8n Webhook node documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)

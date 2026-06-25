import { workflow, node, trigger, sticky, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const AI_PROMPT = `你是一名跨境电商图片 SEO 助手。
请识别这张产品图片，并生成适合 Shopify、独立站和素材库使用的信息。
要求：
1. 文件名使用英文小写
2. 单词之间用短横线连接
3. 文件名不要超过 12 个单词
4. Alt Text 自然描述画面，不要堆关键词
5. 不要编造图片中没有出现的功能
6. 如果无法确认材质、品牌、型号，不要写
7. 输出必须是 JSON，不要包含 markdown 代码块
请输出 JSON 字段：image_description, new_file_name, alt_text, caption, tags, product_type, main_color, scene, confidence_note
confidence_note 只能是 certain 或 uncertain。`;

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Receive Image URL',
    position: [0, 300],
    parameters: {
      httpMethod: 'POST',
      path: 'image-altflow',
      responseMode: 'onReceived',
      options: {},
    },
  },
  output: [{
    body: {
      image_url: 'https://example.com/test-image.jpg',
      original_file_name: 'IMG_001.jpg',
      source: 'manual',
      trace_id: 'img-20260625-0001',
    },
  }],
});

const normalizeInput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize Input',
    position: [240, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'image-url', name: 'image_url', value: expr('{{ $json.body?.image_url ?? $json.image_url ?? "" }}'), type: 'string' },
          { id: 'original-file-name', name: 'original_file_name', value: expr('{{ $json.body?.original_file_name ?? $json.original_file_name ?? (($json.body?.image_url ?? $json.image_url ?? "").split("/").pop() || "unknown.jpg") }}'), type: 'string' },
          { id: 'source', name: 'source', value: expr('{{ $json.body?.source ?? $json.source ?? "manual" }}'), type: 'string' },
          { id: 'trace-id', name: 'trace_id', value: expr('{{ $json.body?.trace_id ?? $json.trace_id ?? ("img-" + $now.toFormat("yyyyMMdd") + "-" + $execution.id.slice(0, 8)) }}'), type: 'string' },
          { id: 'received-at', name: 'received_at', value: expr('{{ $now.toISO() }}'), type: 'string' },
        ],
      },
    },
  },
  output: [{
    image_url: 'https://example.com/test-image.jpg',
    original_file_name: 'IMG_001.jpg',
    source: 'manual',
    trace_id: 'img-20260625-0001',
    received_at: '2026-06-25T15:00:00.000+08:00',
  }],
});

const validateInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate Input',
    position: [480, 300],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `const item = $input.item.json;
const imageUrl = String(item.image_url || '').trim();
let validationOk = true;
let errorType = '';
let errorMessage = '';

if (!imageUrl) {
  validationOk = false;
  errorType = 'missing_image_url';
  errorMessage = 'image_url is required';
} else if (!/^https?:\\/\\//i.test(imageUrl)) {
  validationOk = false;
  errorType = 'invalid_image_url';
  errorMessage = 'image_url must start with http or https';
}

return {
  json: {
    ...item,
    validation_ok: validationOk,
    flow_status: validationOk ? 'running' : 'failed',
    review_status: '',
    error_type: validationOk ? '' : errorType,
    error_message: validationOk ? '' : errorMessage,
    retry_count: 0,
  },
};`,
    },
  },
  output: [{
    image_url: 'https://example.com/test-image.jpg',
    original_file_name: 'IMG_001.jpg',
    source: 'manual',
    trace_id: 'img-20260625-0001',
    received_at: '2026-06-25T15:00:00.000+08:00',
    validation_ok: true,
    flow_status: 'running',
    review_status: '',
    error_type: '',
    error_message: '',
    retry_count: 0,
  }],
});

const checkValidation = ifElse({
  version: 2.2,
  config: {
    name: 'Input Valid?',
    position: [720, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{
          leftValue: expr('{{ $json.validation_ok }}'),
          operator: { type: 'boolean', operation: 'true' },
        }],
        combinator: 'and',
      },
    },
  },
});

const geminiAnalyze = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    name: 'Gemini Analyze Image',
    position: [960, 180],
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'image',
      operation: 'analyze',
      modelId: { __rl: true, mode: 'id', value: 'gemini-2.0-flash-lite' },
      text: AI_PROMPT,
      inputType: 'url',
      imageUrls: expr('{{ $("Validate Input").item.json.image_url }}'),
      simplify: true,
      options: { maxOutputTokens: 1024 },
    },
    credentials: { googlePalmApi: newCredential('Google Gemini(PaLM) Api') },
  },
  output: [{ text: '{"image_description":"A gray bathtub safety seat.","new_file_name":"gray-bathtub-safety-seat.jpg","alt_text":"Gray bathtub safety seat beside a bathtub.","caption":"Bathtub safety seat for elderly support.","tags":["bathroom safety","elderly care"],"product_type":"bathtub safety seat","main_color":"gray","scene":"modern bathroom","confidence_note":"certain"}' }],
});

const parseAiResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse and Normalize AI',
    position: [1200, 180],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `const base = $('Validate Input').item.json;
const aiItem = $input.item.json;

function extractText(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  return payload.text || payload.output || payload.content || payload.response || JSON.stringify(payload);
}

function parseJson(text) {
  let cleaned = String(text || '').trim();
  const fence = String.fromCharCode(96).repeat(3);
  if (cleaned.startsWith(fence)) {
    cleaned = cleaned.slice(fence.length);
    if (cleaned.toLowerCase().startsWith('json')) {
      cleaned = cleaned.slice(4);
    }
    if (cleaned.endsWith(fence)) {
      cleaned = cleaned.slice(0, -fence.length);
    }
    cleaned = cleaned.trim();
  }
  return JSON.parse(cleaned);
}

const requiredFields = ['image_description', 'new_file_name', 'alt_text', 'caption', 'product_type', 'main_color', 'scene'];
let ai = {};
let errorType = '';
let errorMessage = '';

try {
  ai = parseJson(extractText(aiItem));
} catch (error) {
  errorType = 'ai_parse_error';
  errorMessage = error.message || 'Failed to parse AI JSON';
}

if (!errorType) {
  ai.caption = ai.caption || ai.alt_text || '';
  ai.tags = Array.isArray(ai.tags) ? ai.tags : [];
  ai.main_color = ai.main_color || 'uncertain';
  ai.scene = ai.scene || 'uncertain';
  ai.confidence_note = ai.confidence_note || 'uncertain';

  const missing = requiredFields.filter((field) => !ai[field]);
  if (missing.length === requiredFields.length) {
    errorType = 'ai_parse_error';
    errorMessage = 'AI response missing all required fields';
  }
}

const partial = !errorType && requiredFields.some((field) => !ai[field]);
const flowStatus = errorType ? 'failed' : 'success';
const reviewStatus = flowStatus === 'success' ? '待审核' : '';

return {
  json: {
    ...base,
    ...ai,
    tags_text: Array.isArray(ai.tags) ? ai.tags.join(', ') : '',
    flow_status: flowStatus,
    review_status: reviewStatus,
    error_type: partial ? 'partial_ai_result' : errorType,
    error_message: errorMessage,
  },
};`,
    },
  },
  output: [{
    image_url: 'https://example.com/test-image.jpg',
    original_file_name: 'IMG_001.jpg',
    trace_id: 'img-20260625-0001',
    image_description: 'A gray bathtub safety seat.',
    new_file_name: 'gray-bathtub-safety-seat.jpg',
    alt_text: 'Gray bathtub safety seat beside a bathtub.',
    caption: 'Bathtub safety seat for elderly support.',
    tags: ['bathroom safety', 'elderly care'],
    tags_text: 'bathroom safety, elderly care',
    product_type: 'bathtub safety seat',
    main_color: 'gray',
    scene: 'modern bathroom',
    confidence_note: 'certain',
    flow_status: 'success',
    review_status: '待审核',
    error_type: '',
    error_message: '',
    retry_count: 0,
  }],
});

const buildAiErrorRecord = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build AI Error Record',
    position: [1200, 360],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `const base = $('Validate Input').item.json;
const errorItem = $input.item.json;

return {
  json: {
    ...base,
    flow_status: 'failed',
    review_status: '',
    error_type: 'image_fetch_failed',
    error_message: errorItem.error?.message || 'Gemini image analysis failed',
    retry_count: 0,
  },
};`,
    },
  },
  output: [{
    image_url: 'https://example.com/test-image.jpg',
    original_file_name: 'IMG_001.jpg',
    trace_id: 'img-20260625-0001',
    flow_status: 'failed',
    review_status: '',
    error_type: 'image_fetch_failed',
    error_message: 'Gemini image analysis failed',
    retry_count: 0,
  }],
});

const prepareFailedRecord = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare Failed Record',
    position: [960, 420],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'flow-status', name: 'flow_status', value: 'failed', type: 'string' },
          { id: 'review-status', name: 'review_status', value: '', type: 'string' },
        ],
      },
    },
  },
  output: [{
    image_url: '',
    original_file_name: 'unknown.jpg',
    trace_id: 'img-20260625-0002',
    flow_status: 'failed',
    review_status: '',
    error_type: 'missing_image_url',
    error_message: 'image_url is required',
    retry_count: 0,
  }],
});

const getFeishuToken = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Feishu Token',
    position: [1440, 300],
    parameters: {
      method: 'POST',
      url: 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={{ { "app_id": $env.FEISHU_APP_ID, "app_secret": $env.FEISHU_APP_SECRET } }}',
      options: {},
    },
  },
  output: [{ tenant_access_token: 't-xxx', expire: 7200 }],
});

const writeFeishuBitable = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Write Feishu Bitable',
    position: [1680, 300],
    parameters: {
      method: 'POST',
      url: '={{ "https://open.feishu.cn/open-apis/bitable/v1/apps/" + $env.FEISHU_BITABLE_APP_TOKEN + "/tables/" + $env.FEISHU_BITABLE_TABLE_ID + "/records" }}',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: expr('{{ "Bearer " + $("Get Feishu Token").item.json.tenant_access_token }}') },
          { name: 'Content-Type', value: 'application/json' },
        ],
      },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ { "fields": { "原文件名": $("Validate Input").item.json.original_file_name || $json.original_file_name, "图片链接": { "link": $("Validate Input").item.json.image_url || $json.image_url, "text": "preview" }, "图片预览": $("Validate Input").item.json.image_url || $json.image_url, "AI 识别描述": $json.image_description || "", "新文件名": $json.new_file_name || "", "Alt Text": $json.alt_text || "", "Caption": $json.caption || "", "Tags": $json.tags_text || ($json.tags ? $json.tags.join(", ") : ""), "产品类型": $json.product_type || "", "主体颜色": $json.main_color || "", "使用场景": $json.scene || "", "流程状态": $json.flow_status, "审核状态": $json.review_status || "", "异常类型": $json.error_type || "", "异常说明": $json.error_message || "", "重试次数": $json.retry_count || 0, "Trace ID": $("Validate Input").item.json.trace_id || $json.trace_id, "创建时间": Date.now() } } }}'),
      options: {},
    },
  },
  output: [{ code: 0, data: { record: { record_id: 'recxxx' } } }],
});

const shouldNotify = ifElse({
  version: 2.2,
  config: {
    name: 'Should Notify Review?',
    position: [1920, 180],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            leftValue: expr('{{ $("Parse and Normalize AI").item.json.flow_status }}'),
            operator: { type: 'string', operation: 'equals' },
            rightValue: 'success',
          },
          {
            leftValue: expr('{{ $("Parse and Normalize AI").item.json.review_status }}'),
            operator: { type: 'string', operation: 'equals' },
            rightValue: '待审核',
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const sendFeishuNotification = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Send Feishu Chat Notification',
    position: [2160, 180],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://open.feishu.cn/open-apis/im/v1/messages',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: {
        parameters: [
          { name: 'receive_id_type', value: 'chat_id' },
        ],
      },
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: expr('{{ "Bearer " + $("Get Feishu Token").item.json.tenant_access_token }}') },
          { name: 'Content-Type', value: 'application/json' },
        ],
      },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ { "receive_id": $env.FEISHU_REVIEW_CHAT_ID, "msg_type": "text", "content": JSON.stringify({ text: "有新图片待审核\\n原文件名：" + $("Validate Input").item.json.original_file_name + "\\n建议文件名：" + $("Parse and Normalize AI").item.json.new_file_name + "\\nAlt Text：" + $("Parse and Normalize AI").item.json.alt_text + "\\nTrace ID：" + $("Validate Input").item.json.trace_id }) } }}'),
      options: {},
    },
  },
  output: [{ code: 0, data: { message_id: 'om_xxx' } }],
});

const setupNote = sticky(
  '## Image Altflow MVP\n\n配置 n8n 环境变量：\n- FEISHU_APP_ID\n- FEISHU_APP_SECRET\n- FEISHU_BITABLE_APP_TOKEN\n- FEISHU_BITABLE_TABLE_ID\n- FEISHU_REVIEW_CHAT_ID\n\n在 Google Gemini 节点绑定凭证。\n飞书表字段需与 docs/workflow-spec.md 一致。',
  [webhookTrigger, normalizeInput, validateInput, checkValidation, geminiAnalyze, parseAiResult, getFeishuToken, writeFeishuBitable],
  { position: [-40, 80], color: 4 },
);

const feishuWriteChain = getFeishuToken.to(writeFeishuBitable);

const successChain = parseAiResult
  .to(feishuWriteChain)
  .to(shouldNotify.onTrue(sendFeishuNotification));

const geminiChain = geminiAnalyze
  .to(successChain)
  .onError(buildAiErrorRecord.to(feishuWriteChain));

export default workflow('image-altflow-mvp', 'Image Altflow MVP')
  .add(setupNote)
  .add(webhookTrigger)
  .to(normalizeInput)
  .to(validateInput)
  .to(checkValidation
    .onTrue(geminiChain)
    .onFalse(prepareFailedRecord.to(feishuWriteChain)));


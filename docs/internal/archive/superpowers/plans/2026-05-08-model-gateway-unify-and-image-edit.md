# Model Gateway — 统一响应语义 + 图像编辑

**Goal:** 在已有 `packages/model-protocols` 兼容层基础上做两件事：
1. **统一请求/响应语义**：参考 OpenAI Chat Completions 形状，给 `TextGenerationResponse` 补 `usage` / `finishReason` / `id` / `created`；把 `providerOptions` 从扁平 record 改成按 `apiFormat` 命名空间的 map，消除跨 apiFormat 切换时的字段串味。
2. **图像编辑（inpaint / 参考图）**：让 ImageEditDialog 产出的 image + mask 可以直接送回模型做编辑。OpenAI 走原生 `/v1/images/edits`（multipart，像素 mask），Gemini 走新 apiFormat `gemini-image-edit`（`:generateContent` + `inline_data` parts，mask 丢弃、靠 prompt 引导）。

**非目标（本次不做，仅预留扩展点）：**
- text 流式输出
- 错误语义分类
- IPC 层 AbortSignal 接线（类型已存在）
- Imagen 系列的编辑支持（现有 `gemini-images` Imagen predict 路径保持不动）

**Tech Stack:** TypeScript, Vitest, Zod, Electron IPC, `@orison/model-protocols`, `@orison/shared-contracts`.

---

## 设计决策记录

### 为什么以 OpenAI Chat 为参考形状
和项目已选型的 NewAPI 中继协议自然对齐。NewAPI 也是把 Claude / Gemini 都 reshape 到 OpenAI Chat 线形，我们本地形状做一致的选择，调用方代码在经过 NewAPI 和直连 vendor 两条路径下行为相同。

### 为什么 `providerOptions` 按 apiFormat 命名空间
一个 profile 可以有多个 model entry，每个 entry 的 `apiFormat` 不同。调用方传 `providerOptions: { thinking: {...} }` 时，同一 key 在 Claude 下是思考模式、在 OpenAI Chat 下无意义、在 Gemini 下又是另一回事。改成 `providerOptions: { 'claude-messages': { thinking: {...} } }` 后，adapter 只挑自己那一格，其它格被忽略，**跨 apiFormat 切换零串味**。

### 为什么图像编辑分两个 apiFormat 而不是共享一个
OpenAI `/v1/images/edits` 是 multipart 上传，Gemini `:generateContent` 是 JSON + base64 参考图 parts。wire shape 完全不同、字段语义不同（OpenAI 有 mask、Gemini 没有），塞进同一个 adapter 需要在内部做巨大的 if 分支；拆成两个 adapter 更清晰，也符合项目现有"一个 apiFormat 一个文件"的约定。

### 为什么 Gemini 丢 mask 而不做可视化合成
用户明确选择"上传原图作为参考图，mask 丢弃"。保持 renderer 层简单，不新增 canvas 合成逻辑；用户在 prompt 里自行描述编辑意图（"改沙发，其余不变"）。

### 为什么不动 OpenAI 的 `/images/generations` 路径
现有 `openai-images` adapter 已经覆盖 gpt-image-1 / gpt-image-2 的各种新字段（quality, background, output_format 等）。编辑功能是**新增分支**：请求里存在 `image` 字段 → 走 `/images/edits`；不存在 → 继续走 `/images/generations`。这样 request 形状保持统一、向后兼容。

---

## 文件变更清单

### packages/shared-contracts/src/contracts/generation.ts
- 修改 `textGenerationRequestSchema`：`providerOptions` 从 `z.record(z.unknown())` 改成按 apiFormat 命名空间（见下文 schema 细节）
- 修改 `imageGenerationRequestSchema`：同上；另新增 `image` / `mask` / `referenceImages` 字段
- 修改 `videoGenerationRequestSchema`：同上 providerOptions
- 修改 `textGenerationResponseSchema`：新增 `usage?` / `finishReason?` / `id?` / `created?`
- 修改 `modelApiFormatSchema`：枚举追加 `'gemini-image-edit'`
- 修改 `inferApiFormat`：`gemini-*-flash-image*` id 建议 `gemini-image-edit`

### packages/model-protocols/src/protocols/
- 修改 `openaiChat.ts`：读 `providerOptions['openai-chat-completions']`；解析 `usage` / `finish_reason` / `id` / `created` 填入响应
- 修改 `openaiResponses.ts`：读 `providerOptions['openai-responses']`；解析 `usage` / `status` / `id` / `created_at` 填入响应
- 修改 `claudeMessages.ts`：读 `providerOptions['claude-messages']`；`usage.input_tokens` / `output_tokens` → 统一 `usage`，`stop_reason` → 统一 `finishReason`，`id` → `id`
- 修改 `geminiGenerateContent.ts`：读 `providerOptions['gemini-generate-content']`；`usageMetadata.promptTokenCount` / `candidatesTokenCount` → 统一 `usage`，`candidates[0].finishReason` → 统一 `finishReason`
- 修改 `openaiImages.ts`：读 `providerOptions['openai-images']`；新增 edit 分支（存在 request.image 时切到 `/images/edits` + multipart）
- 修改 `geminiImages.ts`：读 `providerOptions['gemini-images']`（不变行为，仅 providerOptions 改命名空间）
- 新增 `geminiImageEdit.ts`：`:generateContent` 端点，参考图 + 原图走 `inline_data` parts，从 `candidates[].content.parts[].inline_data` 抽图
- 修改 `soraVideos.ts`：providerOptions 改命名空间（占位不变）

### packages/model-protocols/src/
- 修改 `registry.ts`：注册 `gemini-image-edit`，加 `['image']` 到 `apiFormatCapabilities`
- 修改 `index.ts`：导出 `geminiImageEditProtocol`
- 新增 `http.ts` helper 或 `multipart.ts`：封装 `postMultipart<T>({ url, headers, formData, signal })` — 用原生 `FormData`，用 `Blob`/`Buffer` 包装 base64

### apps/desktop/ui/src/
- 修改 `shared/api/generation.ts`：`generateImage` 入参加 `image?` / `mask?` / `referenceImages?`
- 修改 `features/editor/ImageGenEditor.tsx`：
  - 新增状态 `editingIntent: 'save' | 'generate' | null`
  - ImageEditDialog 增加"生成变体 / Apply as Edit"按钮，走 generate 分支调 `generateImage` 带 image+mask
  - Gemini 模型下 mask 数据不传（adapter 自动忽略），UI 可选提示
- 修改 `features/editor/ImageEditDialog.tsx`：
  - `onSave` 回调形状增强：新增可选 `intent: 'save' | 'generate'`
  - 新增一个按钮触发 `intent='generate'`

### 测试
- 修改 `packages/shared-contracts/tests/contracts.test.ts`：providerOptions 按命名空间
- 修改 `packages/model-protocols/test/protocols.test.ts`：四个 text adapter 断言 usage/finishReason/id/created 被正确提取；OpenAI edit 分支断言 multipart body；Gemini image-edit 断言请求体和响应解析
- 新增测试覆盖：同一 request 对象带 `providerOptions['claude-messages']` 和 `providerOptions['openai-chat-completions']` 同时存在时，各 adapter 只消费自己那格

### 文档
- 修改 `docs/architecture/module-boundaries.md`：`apiFormats` 列表加 `gemini-image-edit`
- 修改 `docs/ipc/desktop-ipc.md`：`generateImage` 入参新增 image/mask/referenceImages 字段说明
- README `当前状态` 节加一行"图像编辑：OpenAI mask inpaint / Gemini 参考图"

---

## 关键 Schema 定义

### providerOptions 命名空间化

```ts
// 旧
providerOptions: z.record(z.unknown()).optional()

// 新 —— 同一 request 对象可以同时携带多个 apiFormat 的选项
const providerOptionsSchema = z.object({
  'openai-chat-completions': z.record(z.unknown()).optional(),
  'openai-responses': z.record(z.unknown()).optional(),
  'claude-messages': z.record(z.unknown()).optional(),
  'gemini-generate-content': z.record(z.unknown()).optional(),
  'openai-images': z.record(z.unknown()).optional(),
  'gemini-images': z.record(z.unknown()).optional(),
  'gemini-image-edit': z.record(z.unknown()).optional(),
  'sora-videos': z.record(z.unknown()).optional(),
}).partial().optional();
```

Adapter 里：`const opts = request.providerOptions?.[this.apiFormat] ?? {}`；如果某 key 已经有同名顶层字段（`temperature`/`maxTokens` 等），顶层字段优先，`opts` 只补未覆盖的。

### TextGenerationResponse 扩展

```ts
const generationUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
}).partial();

const generationFinishReasonSchema = z.enum([
  'stop', 'length', 'content_filter', 'tool_use', 'other'
]);

// textGenerationResponseSchema 追加：
{
  id: z.string().optional(),
  created: z.number().int().optional(),          // unix seconds
  usage: generationUsageSchema.optional(),
  finishReason: generationFinishReasonSchema.optional(),
}
```

各 provider 的 finishReason 归一映射：
- OpenAI Chat: `stop`→`stop`, `length`→`length`, `content_filter`→`content_filter`, `tool_calls`→`tool_use`, 其它→`other`
- OpenAI Responses: `completed`→`stop`, `incomplete`+reason `max_output_tokens`→`length`, 其它→`other`
- Claude: `end_turn`/`stop_sequence`→`stop`, `max_tokens`→`length`, `tool_use`→`tool_use`, 其它→`other`
- Gemini: `STOP`→`stop`, `MAX_TOKENS`→`length`, `SAFETY`/`RECITATION`→`content_filter`, 其它→`other`

### ImageGenerationRequest 新增字段

```ts
const imageInputSchema = z.object({
  b64Json: z.string().min(1),
  mimeType: z.string().regex(/^image\//),
});

// imageGenerationRequestSchema 追加：
{
  image: imageInputSchema.optional(),                // 要编辑的主图
  mask: imageInputSchema.optional(),                 // 像素 mask（仅 OpenAI）
  referenceImages: z.array(imageInputSchema).max(14).optional(),  // Gemini 3.1 Flash Image 最多 14 张
}
```

`prompt` 字段已经是 min(1) required；编辑场景下 prompt 描述要做的修改。

### 新 apiFormat：gemini-image-edit

- 端点：`POST {baseUrl}/v1beta/models/{model}:generateContent`
- Headers：`x-goog-api-key: {apiKey}`, `content-type: application/json`
- Body：
  ```json
  {
    "contents": [{
      "role": "user",
      "parts": [
        {"text": "<prompt>"},
        {"inline_data": {"mime_type": "image/png", "data": "<base64-of-image>"}},
        {"inline_data": {"mime_type": "image/png", "data": "<base64-of-ref-1>"}}
      ]
    }],
    "generationConfig": {
      "responseModalities": ["IMAGE"],
      // imageConfig / thinkingConfig 走 providerOptions['gemini-image-edit']
    }
  }
  ```
- mask 字段显式忽略（adapter 层不报错，仅 dev-log "mask dropped for gemini-image-edit"）
- 响应抽取：`raw.candidates[0].content.parts[]` 里找所有 `inline_data` 项，生成 `{ b64Json, mimeType }[]`

---

## OpenAI /v1/images/edits 接口约定

- 端点：`POST {baseUrl}/images/edits`
- Headers：`Authorization: Bearer {apiKey}`, 不设 content-type（让 FormData 自动带 boundary）
- Form fields：
  - `image`: Blob（从 b64Json + mimeType 构造）— required
  - `mask`: Blob — optional，尺寸必须和 image 同、alpha=0 处为编辑区域
  - `prompt`: string — required，<= 1000 字符
  - `model`: string — 从 `profile.modelId` 填
  - `n`: string — 可选
  - `size`: string — 可选，dall-e-2 仅 256/512/1024 方形；gpt-image-1 接受更多
  - `response_format`: `'b64_json'` — 固定取 b64_json（和 `openai-images` 现有行为一致）
  - `user`: string — 可选
  - `background` / `output_format` / `output_compression` / `quality` / `moderation`：从 `providerOptions['openai-images']` 透传（NewAPI 文档只列 dall-e-2 字段，这些是 gpt-image-1 新字段走逃生口）

响应形状和现有 `/images/generations` 一致（`data: [{ b64_json }]`），复用 `normalizeImageResponse`。

---

## Phase 1 — 统一响应语义 + providerOptions 命名空间

独立可交付，不依赖 Phase 2。

### Task 1.1：schema 扩展（shared-contracts）

- [ ] **Step 1 — 写失败测试**：在 `packages/shared-contracts/tests/contracts.test.ts` 新增：
  - `TextGenerationRequest` 接受 `providerOptions: { 'claude-messages': { thinking: {...} }, 'openai-chat-completions': { tools: [] } }`
  - `TextGenerationResponse` 接受 `{ usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, finishReason: 'stop', id: 'x', created: 123 }`
  - `ImageGenerationRequest` 接受 `image: { b64Json: 'abc', mimeType: 'image/png' }`, `mask: {...}`, `referenceImages: [{...}, {...}]`
  - 修改旧的扁平 providerOptions 测试（`providerOptions: { tools: [] }` / `providerOptions: { thinking: {...} }` / `providerOptions: { style: 'vivid' }`）改成命名空间形状
- [ ] **Step 2 — 实施**：按「关键 Schema 定义」节改 `packages/shared-contracts/src/contracts/generation.ts`
- [ ] **Step 3 — 验证**：`pnpm --filter @orison/shared-contracts test`（65 -> 新增 5 左右）

### Task 1.2：四个 text adapter 映射响应

- [ ] **Step 1 — 写失败测试**：`packages/model-protocols/test/protocols.test.ts`
  - openai-chat：mock 返回 `{ id, created, choices: [{ message, finish_reason: 'stop' }], usage: { prompt_tokens, completion_tokens, total_tokens } }` → 断言 response.{id, created, finishReason, usage} 被填
  - 其它三个同理
  - 断言 finishReason 归一映射（至少覆盖 `stop` / `length` / `content_filter` 三种情况）
- [ ] **Step 2 — 实施**：改四个 adapter 文件，增加响应字段提取
- [ ] **Step 3 — 验证**：`pnpm --filter @orison/model-protocols test`

### Task 1.3：所有 adapter 改读 providerOptions[ownFormat]

- [ ] **Step 1 — 写失败测试**：同一个 request 对象 `providerOptions: { 'claude-messages': { thinking: 'x' }, 'openai-chat-completions': { tools: ['y'] } }`
  - 用 openai-chat adapter 调：body 里有 `tools: ['y']`，没有 `thinking`
  - 用 claude-messages adapter 调：body 里有 `thinking: 'x'`，没有 `tools`
- [ ] **Step 2 — 实施**：改七个 adapter（四 text + 两 image + 一 video 占位）的 `...(request.providerOptions ?? {})` 为 `...(request.providerOptions?.[this.apiFormat] ?? {})`
- [ ] **Step 3 — 验证**：`pnpm --filter @orison/model-protocols test`

**Phase 1 验收**：
- `pnpm --filter @orison/shared-contracts test` + `pnpm --filter @orison/model-protocols test` 全绿
- `pnpm typecheck` 全绿（renderer 消费方 `textResponse.text` 字段无变化，typecheck 不应有新错）

---

## Phase 2 — 图像编辑（OpenAI + Gemini）

依赖 Phase 1 的 providerOptions 命名空间落地（Gemini Image Edit 会用 providerOptions['gemini-image-edit'] 透传 imageConfig/thinkingConfig）。

### Task 2.1：`gemini-image-edit` apiFormat

- [ ] **Step 1 — schema**：`modelApiFormatSchema` 枚举加 `'gemini-image-edit'`；`apiFormatCapabilities['gemini-image-edit'] = ['image']`；`inferApiFormat` 对 `gemini-*-flash-image*` id 返回 `gemini-image-edit`
- [ ] **Step 2 — 写失败测试**：
  - 请求 body 正确：URL 是 `/v1beta/models/<id>:generateContent?key=<key>`（或 header 形式，两种都能用——跟现有 geminiGenerateContent.ts 对齐，用 query key 更一致）
  - contents[0].parts 第一个是 `{text}`，随后是 `{inline_data: {mime_type, data}}` 若干
  - 当 request 里有 `mask` 字段时，mask 被静默忽略（body 里不含 mask）
  - 当 request 里有 `image` 字段时，`image` 作为 parts 第一个 inline_data
  - `referenceImages` 追加在 image 之后
  - 响应从 `candidates[0].content.parts[]` 里找所有 inline_data，返回 `images[]`
  - `providerOptions['gemini-image-edit']` 里塞 `imageConfig: { aspectRatio: '16:9', imageSize: '2K' }` 被合并进 `generationConfig`
- [ ] **Step 3 — 实施**：新建 `packages/model-protocols/src/protocols/geminiImageEdit.ts`；在 `registry.ts` 登记；`index.ts` 导出
- [ ] **Step 4 — 验证**：`pnpm --filter @orison/model-protocols test`

### Task 2.2：`openai-images` 加 edit 分支

- [ ] **Step 1 — 新增 multipart helper**：在 `packages/model-protocols/src/http.ts` 新增 `postMultipart<T>`，用 `fetch(url, { method: 'POST', headers: {Authorization}, body: formData, signal })` — FormData 会自动设 content-type + boundary
- [ ] **Step 2 — 写失败测试**：
  - 当 `request.image` 存在：端点是 `/images/edits`，请求体是 FormData（测试里用 `captured.init?.body instanceof FormData`），包含 image / prompt / model 字段；有 mask 时 mask 也在 FormData 里
  - 当 `request.image` 不存在：端点是 `/images/generations`，body 是 JSON（现状）
  - base64 → Blob 构造正确（`atob` + `Uint8Array` + `new Blob([], { type: mimeType })`）
- [ ] **Step 3 — 实施**：改 `packages/model-protocols/src/protocols/openaiImages.ts` 加 edit 分支，复用 `normalizeImageResponse`
- [ ] **Step 4 — 验证**：`pnpm --filter @orison/model-protocols test`

### Task 2.3：renderer 消费图像编辑

- [ ] **Step 1 — generation.ts 扩字段**：`apps/desktop/ui/src/shared/api/generation.ts` 的 `generateImage` 入参加 `image?` / `mask?` / `referenceImages?`，原封透传给 IPC
- [ ] **Step 2 — ImageEditDialog**：`onSave` 回调签名增加 `intent: 'save' | 'generate'`（默认 `'save'` 保持向后兼容）；工具栏增加"Generate variant"按钮触发 `intent='generate'`
- [ ] **Step 3 — ImageGenEditor**：
  - 接 `onSave` 的 `intent`：`save` 走现有 `handleSaveEdit`；`generate` 走新 `handleGenerateVariant(item, payload)`
  - `handleGenerateVariant` 把 image + mask + 当前 prompt 送进 `generateImage({ slot, prompt, params, image, mask })`
  - 结果落到 `temp/images/generation/`（和现有生成结果同路径），加入 results 列表，source 设 `'edited'`
  - Gemini slot 下的 mask 在 adapter 层自动被忽略，UI 可保持 mask 按钮可见
- [ ] **Step 4 — 验证**：`pnpm --filter @orison/desktop-ui typecheck`；在现有 test 中加一条：ImageEditDialog 点 Generate 触发回调携带 intent='generate'

### Task 2.4：preload + IPC 类型打通

- [ ] **Step 1**：确认 `packages/shared-contracts/src/ipc.ts` 的 `GenerateImagePayload` 已经通过 `ImageGenerationRequest` 自动继承新字段（不需要额外改动）
- [ ] **Step 2**：确认 `apps/desktop/shell/main/ipc/modelGatewayIpc.ts` `handleGenerateImage` 仍然正确分发——`request` 整体透传给 adapter，image/mask 字段随 adapter 处理
- [ ] **Step 3**：`pnpm typecheck` workspace 全绿

### Task 2.5：文档更新

- [ ] 更新 `docs/architecture/module-boundaries.md` — `apiFormats` 列表加 `gemini-image-edit`
- [ ] 更新 `docs/ipc/desktop-ipc.md` — `generateImage` 载荷新增 `image` / `mask` / `referenceImages` 字段说明；说明 OpenAI 有 mask / Gemini 无 mask 的行为差异
- [ ] 更新 `README.md` 「当前状态」节 — 加一行"图像编辑已联通：OpenAI `/images/edits` + Gemini 参考图"
- [ ] 更新 `plan.md`（根目录）「已收口关键问题」节

**Phase 2 验收**：
- 所有包 test 全绿：`shared-contracts` / `model-protocols` / `desktop-shell` / `desktop-ui`
- `pnpm typecheck` workspace 全绿
- 手工验证（需要真实 apiKey）：
  - 选一个 gpt-image-1 profile，在 ImageEditDialog 画 mask，点 Generate → 收到 edit 结果，mask 区域被替换
  - 选一个 gemini-2.5-flash-image profile，画 mask（adapter 会忽略 mask），prompt 里描述编辑意图 → 收到编辑后的图

---

## 回滚点

- 每个 Task 独立可回滚：只改 schema 不改 adapter 会 typecheck 失败；每个 adapter 改动单独一次 commit
- Phase 1 可以不做 Phase 2 单独落地
- Phase 2 不能没有 Phase 1（Gemini Image Edit 的 imageConfig 透传依赖 providerOptions 命名空间）

## 不做的事情（显式列出）

- **text 流式** — 类型层和 adapter 都不动，`streamText` verb 不加
- **错误语义分类** — `ProtocolHttpError` 形状不变
- **IPC AbortSignal 接线** — `ProtocolCallContext.signal` 保留，modelGatewayIpc 不加 cancel 通道
- **Imagen 编辑** — 现有 `gemini-images` adapter（Imagen predict）保持不变
- **providerOptions 向后兼容 shim** — 生产代码无人传扁平 providerOptions（已 grep 确认），直接改
- **去掉 raw 字段** — adapter 继续在响应里带 raw，方便调试；`stripSecrets` 行为不变

---

## 实施状态

| Task | 状态 | 备注 |
|---|---|---|
| 1.1 schema 扩展 | ✅ 完成 | providerOptions 命名空间 + TextGenerationResponse 新字段 + ImageInput |
| 1.2 text adapter 响应映射 | ✅ 完成 | 四个 adapter 全部映射 usage/finishReason/id/created |
| 1.3 providerOptions 命名空间 | ✅ 完成 | 七个 adapter 全部改为只读自己的命名空间 |
| 2.1 gemini-image-edit | ✅ 完成 | 新 adapter + registry 注册 + inferApiFormat |
| 2.2 openai-images edit 分支 | ✅ 完成 | multipart `/images/edits` + `postMultipart` helper |
| 2.3 renderer 消费图像编辑 | ✅ 完成 | ImageEditDialog intent + ImageGenEditor handleGenerateVariant |
| 2.4 IPC + workspace typecheck | ✅ 完成 | 全绿 |
| 2.5 文档更新 | ✅ 完成 | module-boundaries + desktop-ipc + plan |

**测试结果**：
- `@orison/shared-contracts` 68 tests ✅
- `@orison/model-protocols` 43 tests ✅
- `@orison/desktop-ui` 93/94 ✅（1 个 pre-existing failure: `reviewFlow.test.tsx`，与本次改动无关）
- workspace `pnpm -r typecheck` 全绿

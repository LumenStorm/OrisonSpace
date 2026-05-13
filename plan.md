# 重构计划（2026-05-09）

## 现状总结

1. **模型网关**：已经是统一 OpenAI 兼容层，key-based 路由（`ModelRef = { keyId, modelId }`），不按模型名称走不同接口。✅ 无需改动。

2. **数据库**：server 端 PostgreSQL 存 users 表，桌面端 SQLite 存项目数据。✅ 已完成迁移。

3. **认证**：已改为客户端 SHA-256 散列。✅ 已完成。

4. **模型设置 UI**：左右两栏布局，CSS 已对齐 design.md 规范。✅ 已完成。

---

## 任务 5：用 Vercel AI SDK 替换 `@orison/model-protocols` 兼容层

### 背景

当前 `@orison/model-protocols` 是手写的 OpenAI 兼容 HTTP 调用层，存在以下问题：

1. **不支持 tool calling** — `generateText` 只传 messages/temperature/maxTokens，忽略 tools 参数
2. **不支持 streaming** — 全部是同步 POST → JSON 响应
3. **不支持多 provider 差异** — Anthropic/Google/本地模型各有不同的 API 格式，当前只做了 OpenAI 兼容
4. **agent loop 手动拼装** — `ipc-provider.ts` 自己构造 tool definitions JSON，与 model-protocols 脱节

### 安全约束

**apiKey 不暴露给 agent 进程**。agent 继续通过 `http://localhost:18421`（desktop shell gateway）代理调用模型。密钥始终留在 shell 主进程内。

### 架构

```
Agent ──HTTP──▶ Gateway (shell 主进程, port 18421)
                  │
                  ├─ resolveModel(ref) → { baseUrl, apiKey, modelId }
                  │
                  └─ Vercel AI SDK (generateText / streamText)
                       │
                       └──▶ LLM Provider API
```

Agent 只传 `{ ref: { keyId, modelId }, request: { messages, tools, ... } }`，gateway 负责 resolve + 调用。

### 改动范围

#### 1. 安装依赖

| 包 | 新增依赖 |
|---|---|
| `packages/model-protocols` | `ai@^6`, `@ai-sdk/openai@^3` |

> agent 不需要安装 AI SDK — 它只是 HTTP 客户端。

#### 2. 重写 `packages/model-protocols/src/generate.ts`

```ts
import { generateText as aiGenerateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export function createProvider(model: ResolvedModel) {
  const openai = createOpenAI({ baseURL: normalizeBaseUrl(model.baseUrl), apiKey: model.apiKey });
  return openai.chat(model.modelId);  // 使用 .chat() 强制 Chat Completions API，兼容第三方 OpenAI 兼容端点
}

export async function generateText(model, request, ctx?) {
  const provider = createProvider(model);

  // 从 messages 中提取 system 消息，通过 AI SDK 的 system 参数传递
  const systemParts = [];
  const nonSystemMessages = request.messages.filter(m => {
    if (m.role === 'system') { systemParts.push(m.content); return false; }
    return true;
  });

  const result = await aiGenerateText({
    model: provider,
    system: systemParts.length ? systemParts.join('\n') : undefined,
    messages: nonSystemMessages,  // 转换为 AI SDK 格式
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    tools: request.tools,       // ← tool calling 支持
    abortSignal: ctx?.signal,
  });
  return {
    model: model.modelId,
    text: result.text,
    toolCalls: result.toolCalls?.map(tc => ({ id: tc.toolCallId, name: tc.toolName, arguments: JSON.stringify(tc.args) })),
    finishReason: mapFinishReason(result.finishReason),
    usage: { promptTokens: result.usage?.promptTokens, completionTokens: result.usage?.completionTokens },
  };
}
```

- `generateImage` / `generateVideo` 保持现有 fetch 逻辑不变

#### 3. 扩展 shared-contracts 类型

`TextGenerationRequest` 新增 optional `tools` 字段：
```ts
tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: unknown } }>;
```

`TextGenerationResponse` 新增 optional `toolCalls` 字段：
```ts
toolCalls?: Array<{ id: string; name: string; arguments: string }>;
```

#### 4. Gateway 无需改动

`handleGenerateText` 已经是 `generateText(resolved, payload.request)` — model-protocols 内部签名不变，tools 字段自动透传。

#### 5. Agent `ipc-provider.ts` 微调

当前已经在 payload 中构造了 tools，只需确保 gateway 返回的 `toolCalls` 被正确解析（当前代码已处理 `data.toolCalls`）。主要改动：

- `zodToJsonSchema` 使用 `target: 'jsonSchema7'`（而非 `'openApi3'`），确保 `exclusiveMinimum` 输出为数字而非布尔值，兼容 OpenAI API schema 校验
- 剥离生成的 `$schema` 字段，避免模型 API 拒绝
- 确保响应中 `toolCalls` 字段映射正确

#### 5.5 Agent `routes.ts` abort signal 修复

SSE 端点的 abort 信号改用 `request.raw.socket.on('close')` 而非 `request.raw.on('close')`。后者在 Fastify 中会在请求 body 读取完成后立即触发，导致 agentic loop 还未开始就被中断。

#### 6. 可选：streaming 端点

新增 `POST /model/stream-text` 端点，用 `streamText` + SSE 返回逐 token 结果。agent 的 SSE 端点可对接此接口实现端到端 streaming。本次先确保非流式路径正确。

### 不改动的部分

- `apps/desktop/ui` — 前端不变
- `apps/agent/src/tool/*` — tool 定义不变
- `apps/agent/src/agent/loop.ts` — loop 逻辑不变
- `modelGatewayHttp.ts` — 路由不变（`/model/generate-text` 已存在）
- `modelGatewayIpc.ts` — 签名不变
- Image/Video generation — 保持现有实现

### 文件变更清单

| 文件 | 操作 |
|---|---|
| `packages/model-protocols/package.json` | 加 `ai`, `@ai-sdk/openai` |
| `packages/model-protocols/src/generate.ts` | 重写 `generateText` 用 Vercel AI SDK |
| `packages/model-protocols/src/http.ts` | 保留（image/video 仍用） |
| `packages/model-protocols/src/index.ts` | 新增导出 `createProvider` |
| `packages/shared-contracts/src/contracts/generation.ts` | request 加 tools，response 加 toolCalls |
| `apps/agent/src/provider/ipc-provider.ts` | 微调 tools 格式 + 响应解析 |

### 风险

1. **`@ai-sdk/openai` 兼容性** — 对非标准端点（某些国产模型 API）可能有问题。如遇到，可在 `createProvider` 中加 `compatibility: 'compatible'` 选项。
2. **breaking change** — `TextGenerationResponse` 新增 `toolCalls` 字段，但是 optional，不会 break 现有消费方。
3. **model-protocols 包体积** — `ai` 包约 200KB，可接受。

---

## 任务 4：通用后台任务系统 + 生图页面状态持久化

### 目标

1. 抽象出通用的后台任务队列（BackgroundTask），所有生成类操作（生图、生视频、文本生成）统一走这套机制
2. 切换页面时正在执行的任务不中断，回来能看到结果
3. 生图页面的 prompt、结果列表持久化到 store，切换页面不丢失

---

### 一、通用后台任务 Slice (`backgroundTasksSlice.ts`)

新建 `apps/desktop/ui/src/shared/store/backgroundTasksSlice.ts`

#### 核心类型

```ts
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
type TaskType = 'image_gen' | 'video_gen' | 'text_gen' | 'rewrite';

interface BackgroundTask<TResult = unknown> {
  id: string;
  type: TaskType;
  status: TaskStatus;
  label: string;                 // 用户可见描述，如 "生成图片: a cat..."
  createdAt: string;
  updatedAt: string;
  progress?: number;             // 0-100
  error?: string;
  result?: TResult;
  meta?: Record<string, unknown>; // prompt, params 等任务特定数据
}
```

#### Slice 接口

```ts
type BackgroundTasksSlice = {
  bgTasks: BackgroundTask[];
  
  // 提交任务：传入执行函数，slice 管理生命周期
  submitBgTask: <T>(opts: {
    type: TaskType;
    label: string;
    meta?: Record<string, unknown>;
    execute: (signal: AbortSignal) => Promise<T>;
  }) => string; // 返回 taskId
  
  cancelBgTask: (taskId: string) => void;
  dismissBgTask: (taskId: string) => void;
  clearFinishedBgTasks: () => void;
};
```

#### 关键设计

- **execute 函数由调用方传入**：slice 不关心 API 细节，只管状态 + AbortController
- **并发**：同类型可并发，`Map<taskId, AbortController>` 管理取消
- **持久化**：已完成任务持久化到 localStorage（`orison_bgTasks`），running 的在重启后标记 failed
- **上限**：保留最近 50 条已完成任务

---

### 二、生图页面状态提升到 Store

在 `imageGenSlice.ts` 中增加：

```ts
imageGenPrompt: string;
imageGenResults: ImageGenResultMeta[];  // 轻量版，不含 b64Json
setImageGenPrompt: (prompt: string) => void;
prependImageGenResults: (items: ImageGenResultMeta[]) => void;
markImageGenResultAsset: (id: string) => void;
```

`ImageGenResultMeta` 只存：
```ts
{ id, prompt, tempRelativePath, assetAdded, source, mimeType }
```

持久化：prompt debounce 写 localStorage，results 存 metadata 列表（不含二进制）。

---

### 三、ImageGenEditor 改造

1. `prompt` / `results` 从 store 读取，不再用 `useState`
2. 生成操作改为：
   ```ts
   submitBgTask({
     type: 'image_gen',
     label: `生成: ${prompt.slice(0, 30)}...`,
     meta: { prompt, params },
     execute: async (signal) => {
       const response = await generateImage({ ref, prompt, params, image });
       const saved = await saveToProject(response, projectPath, prompt);
       return saved; // ImageGenResultMeta[]
     },
   });
   ```
3. 任务完成后通过 effect 监听 `bgTasks` 变化，自动 merge 到 `imageGenResults`

---

### 四、任务面板

底部面板 "tasks" tab 展示所有后台任务状态（spinner/✓/✗），支持取消和清除。

---

### 文件变更清单

| 文件 | 操作 |
|------|------|
| `store/backgroundTasksSlice.ts` | 新建 |
| `store/appStore.ts` | 注册新 slice |
| `store/imageGenSlice.ts` | 增加 prompt/results 持久化 |
| `store/types.ts` | 增加 BackgroundTask 类型 |
| `features/editor/ImageGenEditor.tsx` | 从 store 读状态，生成走 submitBgTask |
| `store/tasksSlice.ts` | 迁移 submitRewrite 使用 backgroundTasksSlice |

---

### 迁移策略

- 现有 `tasksSlice.submitRewrite` 改为内部调用 `submitBgTask`
- `acceptedPatches` 等 rewrite 特有逻辑保留在 `tasksSlice`
- 不破坏现有 rewrite 功能

---

## 任务 7：Agent 请求经 Server 中转（2026-05-13）

### 目标

Desktop UI 不再直连 Agent，所有 `/v1/agent/*` 请求统一经 Server 中转，Server 做 JWT 认证校验后透传到 Agent。同时删除已废弃的 orchestration proxy（Agent 端无对应实现）。

### 当前状态

```
Desktop UI ──直连──→ Agent (localhost:18422)  /v1/agent/*
Desktop UI ──→ Server (localhost:43117) ──→ Agent  /v1/orchestration/* (空转，Agent 未实现)
```

### 目标状态

```
Desktop UI ──→ Server (localhost:43117) ──→ Agent (localhost:18422)
                  ↑ JWT 校验
统一走 /v1/agent/*，删除 /v1/orchestration/* 代理
```

### 改动范围

#### 1. Server 端：新增 Agent 代理模块

**新文件**: `apps/server/src/modules/agent/proxy.ts`

代理以下 6 个端点：

| 方法 | Server 路由 | 转发到 Agent |
|------|------------|-------------|
| POST | `/v1/agent/sessions` | `/v1/agent/sessions` |
| GET | `/v1/agent/sessions/:id` | `/v1/agent/sessions/:id` |
| DELETE | `/v1/agent/sessions/:id` | `/v1/agent/sessions/:id` |
| GET | `/v1/agent/sessions` | `/v1/agent/sessions?projectPath=...` |
| POST | `/v1/agent/sessions/:id/confirm` | `/v1/agent/sessions/:id/confirm` |
| POST | `/v1/agent/sessions/:id/stream` | `/v1/agent/sessions/:id/stream` (SSE 透传) |

**认证**：所有路由自动受现有 `authPlugin` 的 `onRequest` hook 保护（JWT 校验），无需额外代码。

**SSE 透传**：stream 端点使用 Fastify `reply.raw` 直接 pipe Agent 的 response body，不解析 SSE 内容，保持最低延迟。

#### 2. Server 端：删除 orchestration proxy

**删除文件**: `apps/server/src/modules/orchestration/proxy.ts`
**修改文件**: `apps/server/src/app.ts` — 移除 `registerOrchestrationProxy` 注册，替换为 `registerAgentProxy`。

#### 3. Desktop UI 端：改 base URL + 注入 auth token

**修改文件**: `apps/desktop/ui/src/shared/api/agent.ts`

- `AGENT_BASE` 从 `http://localhost:18422` 改为 `http://localhost:43117`
- 所有 fetch 请求添加 `Authorization: Bearer <token>` header（从现有 auth store 获取）

#### 4. Desktop UI 端：移除 orchestration API 调用

**删除/清理**: Desktop 中对 `/v1/orchestration/*` 的调用代码（`orchestration.ts`、`novelChapter.ts` 中相关函数），因为 Agent 端从未实现这些路由。

### 不改动

- Agent 端代码不变
- SSE 事件格式不变
- Desktop UI 的 SSE 解析逻辑不变

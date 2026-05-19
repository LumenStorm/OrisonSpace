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
    tools: request.tools,
    abortSignal: ctx?.signal,
  });
  return { text: result.text, toolCalls: result.toolCalls };
}
```

#### 3. Gateway 适配

`apps/desktop/shell/main/ipc/modelGatewayHttp.ts` 改为调用新的 `generateText`。

#### 4. Agent IPC provider 简化

`apps/agent/src/ipc-provider.ts` 不再手动拼 tool JSON schema — 直接传 tools 数组给 gateway，由 AI SDK 处理格式。

### 不改动

- `ModelRef` / `ModelConfig` 类型不变
- UI 层模型选择逻辑不变
- key 管理 / 加解密不变

---

## 任务 6：Agent Gateway 集成

### 目标

将 Agent 端的 HTTP API 通过 Server 代理暴露给 Desktop UI，替代当前 Desktop 直连 Agent 的方式。

### 改动范围

#### 1. Server 端：新增 Agent proxy 路由

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

---

## 任务 7：小说/剧本数据结构重构

### 目标

去掉 act（幕）概念，改为：项目总览 → 世界观设定（独立）→ 大纲简介 → 章 > 节 → 资产

### 变更范围

#### 1. shared-contracts: project.ts — Schema 重构

**删除：**
- `actSchema`, `beatSchema`, `outlineSchema`, `detailedOutlineSchema`, `actDetailSchema`, `sceneBriefSchema`
- `chapterSchema` 中的 `act_id` 字段
- `sceneSchema` 中的 `act_id` 字段

**新增/修改：**

```typescript
// 项目总览 — projectMetaSchema 扩展
projectMetaSchema → 新增 logline, genre, writing_style 字段

// 章节新增 section 层级
sectionSchema = { id, title?, sort_order, content_file, word_count }
chapterSchema = { id, title, sort_order, summary?, summary_source('ai'|'user'), status, word_count, generated_at?, sections[] }
novelSchema = { chapters: chapterSchema[] }

// 资产扩展
characterSchema → 新增 aliases, backstory, relationships 字段
locationSchema → 新增 type 字段
propSchema = { id, name, type, description }
assetsSchema = { characters[], locations[], props[] }
```

**projectDocumentSchema 调整：**
- 删除 `outline` (旧版)、`detailed_outline`
- 保留 `outline_v2`（大纲简介，内含 synopsis）
- 保留 `episode_outlines`, curves
- `world_setting` 保持独立
- `assets` 使用新的扩展 schema

#### 2. shared-contracts: creative-fields.ts

- `outlineV2Schema` 中删除 `acts` 数组，改为 `synopsis`（单一文本块）

#### 3. SQLite schema — apps/desktop/shell/main/db/index.ts

`projects` 表新增列：
```sql
ALTER TABLE projects ADD COLUMN logline TEXT;
ALTER TABLE projects ADD COLUMN genre TEXT;
ALTER TABLE projects ADD COLUMN writing_style TEXT;
```

#### 4. local-bff: localProjectRepository.ts

- `createEmptyProjectDocument` 适配新结构（不再创建空 outline.acts）
- `applyFieldPatches` 中 chapter_candidate 逻辑适配 section
- 加载兼容：旧 chapter 无 sections 时自动包装为单 section

#### 5. local-bff: novelProjectRepository.ts

- 适配新的 chapter → section 结构
- `acceptChapterCandidate` 改为写入 section 级别的 content_file

#### 6. shell: chapterHandlers.ts

- 适配新的目录结构（section 文件命名）

#### 7. UI store: novelChapterSlice.ts

- `NovelChapterMeta` 类型新增 `sections` 字段、`summarySource` 字段

#### 8. UI store: types.ts

- `ProjectMeta` 新增 `logline`, `genre`, `writingStyle`

#### 9. docs/data-dictionary.md

- 更新本地项目文件结构描述
- 更新字段关系

### 兼容性策略

- 旧 `outline` 字段标记 `@deprecated`，保留但设为 optional
- `project.yaml` 加载时做兼容转换：旧 chapter 无 sections 时自动包装为单 section
- SQLite 用 `ALTER TABLE ADD COLUMN` 做非破坏性迁移

### 执行顺序

1. `packages/shared-contracts/src/contracts/project.ts`
2. `packages/shared-contracts/src/contracts/creative-fields.ts`
3. `apps/desktop/shell/main/db/index.ts`
4. `apps/desktop/local-bff/sync/localProjectRepository.ts`
5. `apps/desktop/local-bff/sync/novelProjectRepository.ts`
6. `apps/desktop/shell/main/ipc/toolHandlers/chapterHandlers.ts`
7. `apps/desktop/ui/src/shared/store/novelChapterSlice.ts`
8. `apps/desktop/ui/src/shared/store/types.ts`
9. `docs/data-dictionary.md`

# Archive Notice

This document is historical and contains stale paths from earlier migration work.
Do not use it as current implementation guidance without checking `README.md`,
`TODO.md`, and the live `apps/` source tree first.

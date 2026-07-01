# Agent 上下文管理方案（Context Management） ✅ Implemented

## 问题定义

当前 agent 的 `runLoop` 每轮将 `session.messages` **全量**传给 LLM，无任何裁剪。长对话下：
1. **上下文漂移** — 模型逐渐忘记写作指令、角色设定、风格约束
2. **上下文溢出** — 超模型 window 后 API 报错或被截断
3. **token 浪费** — 历史 tool result（如 `read_file` 返回的大段内容）永久占用 budget

---

## 设计目标

- 自动管理上下文，用户无需手动操作
- 关键信息（角色设定、写作指令、风格要求）通过 Pinned Context 始终保持在上下文前部
- 固定按 **1,000,000 token** 作为统一 context window，**75% (750,000)** 触发压缩
- 用同一个模型做摘要（不依赖额外的 subagent 模型）
- 对现有 session 持久化格式向后兼容

---

## 架构总览

```
发送给 LLM 的消息结构：

┌─────────────────────────────────────────────────┐
│  System Prompt （固定前缀，利用 prompt cache）    │  ← 始终完整
├─────────────────────────────────────────────────┤
│  Pinned Context                                  │  ← 用户钉住的角色卡/设定/指令
├─────────────────────────────────────────────────┤
│  Compacted Summary                               │  ← LLM 摘要的历史对话
├─────────────────────────────────────────────────┤
│  Recent Window                                   │  ← 最近 N 轮完整消息
└─────────────────────────────────────────────────┘
```

---

## Layer 1：Token Budget + 自动压缩

### 1.1 Token 估算

**新增 `context/tokenEstimator.ts`**

```typescript
/**
 * 固定 context window = 1,000,000 tokens
 * 触发阈值 = 75% = 750,000 tokens
 * 压缩目标 = 50% = 500,000 tokens
 */
export const CONTEXT_WINDOW = 1_000_000;
export const COMPACTION_TRIGGER_RATIO = 0.75;
export const COMPACTION_TARGET_RATIO = 0.50;

export function estimateTokens(text: string): number {
  // 中文字符平均 ~1.5 token/字，英文 ~0.25 token/word ≈ 1 token/4chars
  // 混合场景取 1 token / 3.5 chars 作为经验值
  return Math.ceil(text.length / 3.5);
}

export function estimateMessagesTokens(messages: SessionMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content);
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        total += estimateTokens(tc.arguments) + estimateTokens(tc.name) + 10;
      }
    }
    if (msg.toolResults) {
      for (const tr of msg.toolResults) {
        total += estimateTokens(tr.output) + 10;
      }
    }
    total += 4; // message framing overhead
  }
  return total;
}

export function shouldTriggerCompaction(
  systemTokens: number,
  messagesTokens: number,
  calibrationRatio: number = 1.0,
): boolean {
  const estimated = (systemTokens + messagesTokens) * calibrationRatio;
  return estimated > CONTEXT_WINDOW * COMPACTION_TRIGGER_RATIO;
}
```

**校准机制：** 每次 API 返回 `usage.promptTokens` 后，更新校准系数：
```typescript
// ratio = actualTokens / estimatedTokens, 指数移动平均
newRatio = oldRatio * 0.8 + (actual / estimated) * 0.2;
```

### 1.2 自动压缩触发

**改造 `agent/loop.ts`** — 在每次调用 `generate()` 前检查 token budget：

```typescript
// 在 runLoop 的 while 循环中，generate() 之前
const allMessages = [...messages, ...result];
const systemTokens = estimateTokens(systemPrompt);
const messagesTokens = estimateMessagesTokens(allMessages);

if (shouldTriggerCompaction(systemTokens, messagesTokens, calibrationRatio)) {
  const compacted = await compactWithSummarization(allMessages, {
    targetTokens: CONTEXT_WINDOW * COMPACTION_TARGET_RATIO,
    preserveRecent: 6,
    pinnedContext: session.pinnedContext,
    existingSummary: session.contextState?.compactedSummary,
    generate,
    abort,
  });
  // 更新 messages 引用为压缩后的结果
  // 更新 session.contextState
}
```

**触发阈值设计：**
- `75%` (750K) 触发压缩 — 留 25% buffer 给当前轮的输出 + 新工具调用
- 压缩目标 `50%` (500K) — 压缩后留足够空间继续增长，避免频繁压缩
- 保留最近 `6` 条消息（约 3 轮对话） — 保持即时连贯性

### 1.3 LLM 摘要压缩

**新增 `context/summarizer.ts`**

```typescript
export interface CompactionResult {
  summary: string;                     // LLM 生成的结构化摘要
  retainedMessages: SessionMessage[];  // 保留的最近消息
  compactedCount: number;              // 被压缩的消息数
  estimatedSavedTokens: number;        // 节省的估算 token 数
}

export interface CompactionOptions {
  targetTokens: number;
  preserveRecent: number;
  pinnedContext?: PinnedContextItem[];
  existingSummary?: string;            // 前一次摘要（增量压缩用）
  generate: GenerateFn;
  abort: AbortSignal;
}
```

**摘要 prompt：**
```
你是一个对话历史压缩助手。请将以下对话历史压缩为结构化摘要。

要求：
1. 保留所有关键决策和结论
2. 保留用户明确的指令和偏好
3. 保留重要的文件修改记录（哪个文件做了什么改动）
4. 丢弃冗余的工具输出细节（文件完整内容、搜索结果原文等）
5. 保留错误和修复的因果关系
6. 用简洁的列表形式组织

输出格式：
## 对话摘要
- [关键决策/结论]
- [用户指令/偏好]
- [文件修改记录]
- [当前进行中的任务状态]
```

**摘要策略：**
- 只压缩 `messages[0..N-preserveRecent]`，最近消息原样保留
- tool result 中超过 500 字符的内容在传给摘要模型前先截断为 `[工具名] 返回了 xxx 的内容（已截断）`
- 如果已存在前一次 summary，将其作为上下文传入（增量摘要，不重复总结已总结过的内容）
- 摘要调用不带 tools（纯文本生成，节约 token）

---

## Layer 2：分层保留策略（Priority-based Retention）

### 2.1 Pinned Context（钉住上下文）

**新增 `context/pinnedContext.ts`**

```typescript
export interface PinnedContextItem {
  id: string;
  type: 'character' | 'worldbuilding' | 'instruction' | 'style' | 'custom';
  label: string;
  content: string;
  priority: number;  // 0-100，越高越优先保留
  createdAt: number;
  source?: 'user' | 'auto';  // auto = agent 从对话中自动提取
}
```

**来源：**
- **用户手动 pin** — 在 agent panel 中选择一段文本 → "钉住为上下文"
- **自动提取** — 当检测到用户在前几轮给出写作指令/角色设定时，agent 主动建议 pin

**存储位置：** `{projectPath}/.orison/sessions/{sessionId}.pinned.json`

**在消息中的位置：** System prompt 之后、历史摘要之前（最高优先级区域）

**token 预算：** Pinned context 总量上限建议 50,000 tokens（约 175,000 字符），超出时按 priority 排序裁剪最低优先级的项

### 2.2 消息级别保留优先级

```typescript
type RetentionPriority = 'critical' | 'normal' | 'compressible';

function classifyMessage(msg: SessionMessage): RetentionPriority {
  if (msg.role === 'user') return 'critical';
  if (msg.role === 'assistant' && !msg.toolCalls) return 'normal';
  if (msg.role === 'tool') {
    const totalOutput = msg.toolResults?.reduce((sum, r) => sum + r.output.length, 0) ?? 0;
    return totalOutput > 2000 ? 'compressible' : 'normal';
  }
  return 'normal';
}
```

**压缩策略按优先级分层：**
1. `compressible`（大段 tool output） → 首先被压缩，传给摘要模型时截断
2. `normal`（assistant 回复） → 在摘要中保留要点
3. `critical`（用户消息） → 在摘要中逐条保留原文或接近原文的缩写

### 2.3 Tool Result 即时压缩

对于执行完的 tool result，如果内容超过阈值：
- `read_file` 返回 > 3000 字符 → 保留完整版在当前轮（模型需要看），但标记 `compressible`
- 下次压缩时 → 替换为 `[read_file: path/to/file.md — 共 2000 字，包含角色设定、第三章内容]`

不影响当前轮的工具使用体验，只在后续压缩时生效。

---

## Layer 3：Prompt Cache 管理

### 3.1 缓存分区设计

```
Cache Anchor Point（稳定前缀）:
├── System Prompt （session 生命周期内固定）
├── Pinned Context （变动频率低）
└── cache_control 标记边界

可变区域:
├── Compacted Summary （压缩时更新）
└── Recent Messages  （每轮变化）
```

### 3.2 实现方式

**改造 `provider/ipc-provider.ts` 的 `messagesToPayload()`：**

```typescript
function messagesToPayload(messages, system, tools, cacheConfig?) {
  const formatted = [];
  
  // System + Pinned = 固定前缀，利用 provider 的 prompt cache
  formatted.push({
    role: 'system',
    content: system,
    ...(cacheConfig?.enablePromptCache && { cache_control: { type: 'ephemeral' } }),
  });
  
  // Pinned context 作为固定对话前缀
  if (cacheConfig?.pinnedContent) {
    formatted.push({
      role: 'user',
      content: `[Pinned Context]\n${cacheConfig.pinnedContent}`,
      ...(cacheConfig.enablePromptCache && { cache_control: { type: 'ephemeral' } }),
    });
    formatted.push({
      role: 'assistant',
      content: '已记录上下文设定。',
    });
  }
  
  // 压缩摘要
  if (cacheConfig?.compactedSummary) {
    formatted.push({
      role: 'user', 
      content: `[Earlier conversation summary]\n${cacheConfig.compactedSummary}`,
    });
    formatted.push({
      role: 'assistant',
      content: '已了解之前的对话内容。',
    });
  }
  
  // Recent messages（不变）
  for (const m of messages) { ... }
}
```

### 3.3 兼容性

- Claude API：`cache_control: { type: 'ephemeral' }` → prefix cache 命中时 90% 折扣
- OpenAI：自动 prompt cache，无需特殊标记，前缀匹配自动生效
- DashScope/Qwen/其他：不支持 `cache_control` 的 provider 会忽略该字段（OpenAI-compatible API 兼容）

---

## 数据结构变更

### SessionState 扩展

```typescript
interface SessionState {
  // ... 现有字段 ...
  
  contextState?: {
    compactedSummary?: string;        // 当前生效的摘要文本
    compactionCount: number;          // 压缩执行次数
    lastCompactionAt?: number;        // 上次压缩时间 (Unix ms)
    totalCompactedMessages: number;   // 历史上被压缩过的消息总数
    tokenCalibrationRatio: number;    // 估算校准系数（默认 1.0）
  };
  pinnedContext?: PinnedContextItem[];
}
```

### SessionMessage 扩展

```typescript
interface SessionMessage {
  // ... 现有字段 ...
  retention?: 'critical' | 'normal' | 'compressible';  // 可选，默认 'normal'
}
```

### 持久化格式变更

- `{sessionId}.meta.json` 增加 `contextState` 和 `pinnedContext` 字段
- JSONL 格式不变（`retention` 只是新增可选字段，旧消息自动视为 `normal`）
- 新增 `{sessionId}.pinned.json`（可选，Pinned Context 独立存储）

---

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `agent/src/context/tokenEstimator.ts` | **新增** | Token 估算 + 校准 + 常量定义 |
| `agent/src/context/summarizer.ts` | **新增** | LLM 摘要压缩引擎 |
| `agent/src/context/pinnedContext.ts` | **新增** | Pinned Context CRUD + token 预算裁剪 |
| `agent/src/context/contextManager.ts` | **新增** | 总协调器：检查 budget → 触发压缩 → 组装 payload |
| `agent/src/context/compaction.ts` | **改造** | 保留旧接口兼容，新增 `compactWithSummarization()` |
| `agent/src/types.ts` | **修改** | SessionState + SessionMessage 扩展字段 |
| `agent/src/agent/loop.ts` | **修改** | generate 前调用 contextManager |
| `agent/src/provider/ipc-provider.ts` | **修改** | messagesToPayload 支持 cache_control + 分层注入 |
| `agent/src/agent/session.ts` | **修改** | addMessage 时标记 retention |
| `agent/src/agent/persistence.ts` | **修改** | 持久化 contextState + pinnedContext |
| `agent/src/runtime/workflow.ts` | **修改** | 将 contextManager 接入 streamMessage/sendMessage |

---

## 运行时流程（每轮 generate 前）

```
1. contextManager.prepare(session, systemPrompt):
   a. estimatedTokens = estimateTokens(system) + estimateTokens(pinned) + estimateMessages(messages)
   b. 乘以 calibrationRatio 校准
   
2. if estimatedTokens > 750,000:
   a. 按 retention priority 对早期消息分类
   b. 将 compressible + normal 的早期消息序列化为文本
   c. tool result > 500 字符截断后传给 summarizer
   d. 调同模型（无 tools）生成摘要
   e. 用 summary + tail 替换 session.messages 中的发送队列
   f. 更新 session.contextState（compactedSummary, compactionCount++）
   g. 持久化更新

3. 组装最终 LLM payload:
   [system prompt]
   + [pinned context（如有）+ cache_control]
   + [compacted summary（如有）]
   + [recent messages]
   
4. 调 generate(payload)

5. 从 response.usage.promptTokens 更新校准系数
```

---

## 向后兼容性

- 现有 session 无 `contextState` → 默认 `{ compactionCount: 0, totalCompactedMessages: 0, tokenCalibrationRatio: 1.0 }`
- 现有 session 无 `pinnedContext` → 视为空数组
- 现有消息无 `retention` → 运行时通过 `classifyMessage()` 动态判断
- 旧版 continuation snapshot 兼容：`compactConversation()` 保留原有接口

---

## 关键设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Context window 值 | 固定 1M | 避免维护模型限制表的复杂度；主流模型已普遍支持 128K+，1M 是安全上限 |
| Token 估算方式 | 字符数 / 3.5 + 校准 | 轻量、无额外依赖、通过实际 usage 自校准 |
| 摘要模型 | 同模型 | 不引入额外 subagent 模型依赖 |
| 压缩数据保留 | JSONL 保留原始全量 | 压缩只影响 LLM payload，不删数据，用户可回溯 |
| Pinned Context | 独立于消息流 | 不参与压缩，始终在 system prompt 后注入 |

---

## 已确认决策

1. **摘要语言** — 跟随软件内的设定语言（从 app 语言配置读取）
2. **压缩通知** — 压缩发生时在 UI 显示 toast 提示（如 "上下文已自动压缩，保留了最近 N 轮对话"）
3. **Pinned Context 操作方式** — Phase 1 只做 agent tool 层（`pin_context` / `unpin_context`），UI 控件后续迭代
4. **回溯 UI** — 不做额外处理。压缩只影响发给 LLM 的 payload，agent panel 渲染的仍是 `session.messages` 全量，用户看到的聊天记录不受影响

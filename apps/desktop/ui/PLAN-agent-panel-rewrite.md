# Agent Panel 重写方案

## 需求总结

- Agent 面板作为**独立右侧面板**，通过 Icon Rail 图标触发，可拖拽宽度
- 功能：对话消息流 + 工具执行卡片 + 会话历史列表
- **三档权限模式**：auto / suggest / readonly（全部前端控制）
- **双向联动**：Agent 自动获取当前编辑器上下文，tool 结果可写入编辑器
- 样式完全对齐 tokens.css 设计系统
- **所有 UI/样式/联动逻辑在 `apps/desktop/ui` 中**，agent 后端只提供 API 不变

---

## 一、样式重写（agent-panel.css）

全部删除重写，使用 tokens.css 变量：

| 当前（错误） | 替换为 |
|---|---|
| `var(--surface-secondary, #1a1a2e)` | `var(--surface-container-low)` |
| `var(--border, #2a2a3e)` | `var(--outline-variant)` |
| `var(--text-primary, #e0e0e0)` | `var(--on-surface)` |
| `var(--text-secondary, #a0a0b0)` | `var(--on-surface-variant)` |
| `var(--text-tertiary, #666)` | `var(--outline)` |
| `var(--hover, rgba(...))` | `var(--hover-overlay)` |
| `var(--accent, #6c8cff)` | `var(--accent)` |
| `var(--error, #f44336)` | `var(--error)` |

**规范**：
- 单位全部 rem（0.25/0.35/0.5/0.75/1rem）
- 面板背景 `var(--surface-container-low)`（同 project-tree-panel）
- 头部 `padding: 0.5rem 0.75rem`，`border-bottom: 1px solid var(--outline-variant)`
- 按钮同 icon-rail-btn 风格（border-radius 0.35rem, transition 0.15s）
- 输入框 `border: 1px solid var(--outline-variant)`, `background: var(--surface)`, `border-radius: 0.35rem`
- 用户消息 `var(--surface-container-high)`，助手消息无背景

---

## 二、面板布局

**不改**。当前 WorkspaceLayout 已正确实现：AgentPanel 在 EditorArea 右侧 flex 布局 + ResizeHandle。Icon Rail 已有 `smart_toy` 按钮触发 `toggleAgentPanel`。

---

## 三、三档权限模式（纯前端控制）

### 模式定义

| 模式 | 含义 | 前端行为 |
|---|---|---|
| `auto` | 自动 | 收到写入类 tool 结果后，直接调用 `updateChapter` 写入编辑器 |
| `suggest` | 建议 | 收到写入类 tool 结果后，渲染 DiffCard，用户 Accept 后才写入 |
| `readonly` | 只读 | 发送消息时不传写入类 tool 上下文（或前端忽略写入结果） |

### 写入类 tool 识别

前端维护一个白名单：`['chapter_write', 'write_file', 'outline_update']`

### 改动文件

- `shared/store/types.ts`：`AgentMode = 'auto' | 'suggest' | 'readonly'`
- `shared/store/agentSlice.ts`：默认 `'suggest'`，tool 事件处理增加 mode 分支
- `features/agent-panel/AgentInput.tsx`：模式选择器改为按钮组

---

## 四、双向联动（纯前端）

### 4.1 发送时附加上下文

`agentSlice.sendAgentMessage` 中，发送前从 store 读取：
- `activeChapterId` → 找到对应 chapter 的 title + content
- 拼接为消息前缀：`[Context: 当前编辑章节 "xxx"]\n{content前500字}\n---\n用户问题`

这样 agent 后端无需改动，它只看到一条普通用户消息。

### 4.2 Tool 结果写入编辑器

SSE 返回 tool 事件时：
1. 检查 `toolId` 是否在写入白名单中
2. 从 `metadata` 中提取写入内容（agent 后端 chapter_write 已返回 `{ fileName, content }`）
3. 根据 mode：
   - **auto**：直接 `updateChapter(matchedId, { content })`
   - **suggest**：将 pending write 存入 store，渲染 DiffCard
   - **readonly**：忽略

### 4.3 DiffCard 组件

简单的 before/after 文本对比卡片：
- 显示章节名 + 变更摘要（+N行 / -N行）
- Accept 按钮 → 执行写入
- Reject 按钮 → 丢弃
- 不引入外部 diff 库，用简单的行数对比即可

---

## 五、改动文件清单

全部在 `apps/desktop/ui/src/` 下：

| 文件 | 操作 |
|---|---|
| `features/agent-panel/agent-panel.css` | **重写** |
| `features/agent-panel/AgentPanel.tsx` | **小改** - 头部增加模式标签 |
| `features/agent-panel/AgentInput.tsx` | **改** - 模式按钮组替换 select |
| `features/agent-panel/AgentMessageItem.tsx` | **改** - 写入类 tool 渲染 DiffCard |
| `features/agent-panel/AgentToolCard.tsx` | **小改** - 样式 class 对齐 |
| `features/agent-panel/AgentConfirmCard.tsx` | **小改** - 样式对齐 |
| `features/agent-panel/AgentHistory.tsx` | **小改** - 样式对齐 |
| `features/agent-panel/DiffCard.tsx` | **新增** |
| `shared/store/types.ts` | **改** - AgentMode 定义 |
| `shared/store/agentSlice.ts` | **改** - context 附加 + mode 行为 |
| `shared/api/agent.ts` | **不改**（后端 API 不变） |

**Agent 后端不改**。

---

## 六、实施顺序

1. `types.ts` AgentMode 改定义
2. `agent-panel.css` 全部重写
3. `agentSlice.ts` 增加 mode 行为 + context 逻辑
4. 组件改造（AgentInput、AgentPanel、各卡片样式对齐）
5. 新增 DiffCard 组件
6. typecheck 验证

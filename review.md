# Orison Space 编辑器审阅（小说创作视角）

> 审阅日期：2026-06-05
> 定位：本文档以**小说 / 文档创作工具**的标准审阅，参照对象是 Scrivener / iA Writer / Ulysses / 起点作家助手，而非 VSCode 类 IDE。代码层面的语法高亮、行操作、Goto Line、列标尺等 IDE 特性**不在**本次范围内。
> 范围聚焦三块：正文编辑器（`.md` / `.txt` / `.docx`）、版本管理（git 时间线）、选段 → Agent（AI 评阅 / 引用）。

> **页面样式改动约定**：本文档涉及任何 UI / 页面样式改动时，必须遵循项目既有的 CSS 风格与整体设计语言——
> - 复用 [tokens.css](apps/desktop/client/ui/src/shared/styles/tokens.css) 中的设计令牌（颜色 / 间距 / 字体 / 圆角），不要硬编码色值或尺寸；
> - 新样式按既有分层归位（`base/` / `layout/` / `editor/`），统一经 [global.css](apps/desktop/client/ui/src/shared/styles/global.css) 入口 `@import`，保持级联顺序，不单独引入子文件；
> - 命名、类名约定、light/dark 主题适配方式与周边代码保持一致；
> - 视觉风格（圆角、留白、字重、图标用 material-symbols）跟随现有组件，不引入新的视觉体系。

---

## 一、正文编辑器（.md / .txt / .docx）

### 现状

- `.md` → [MarkdownEditor](apps/desktop/client/ui/src/features/editor/file-editor/MarkdownEditor.tsx)（TipTap，可编辑，带大纲 + 字数栏）
- `.yaml/.yml` → [CodeEditor](apps/desktop/client/ui/src/features/editor/file-editor/CodeEditor.tsx)（配置文件，非正文）
- 其它（含 `.txt`）→ [ReadOnlyPreview](apps/desktop/client/ui/src/features/editor/file-editor/ReadOnlyPreview.tsx)（**只读** `<pre>`）
- 章节正文 → [ScriptEditor](apps/desktop/client/ui/src/features/editor/ScriptEditor.tsx)（TipTap pure 模式，780px 行宽）

### 🔴 修改意见（Bug / 缺陷）

**1. `.txt` 不可编辑** — [FileEditor.tsx:21-29](apps/desktop/client/ui/src/features/editor/FileEditor.tsx#L21-L29) 只把 `.md` 路由到编辑器，`.txt` 落到只读预览。网文作者大量用 `.txt` 写稿，核心格式却不能编辑。
建议：新增纯文本编辑器分支（`.txt` / 无扩展名 / `.text`），用 textarea 或 TipTap plaintext 模式，可编辑、可保存、带字数栏。

**2. 字数统计对中文是错的** — [EditorStatusBar.tsx:7](apps/desktop/client/ui/src/features/editor/file-editor/EditorStatusBar.tsx#L7) 用 `content.trim().split(/\s+/)` 算"词数"，中文整段无空格会被算成 1 个词，但 UI 标的是"{words} 字"。中文小说"字数"应按**字符数**（通常可选去掉空白/标点）。这是写作工具的命脉指标，目前对中文失真。
注：项目最近 commit 已把 *project word count* 改为 char-based，但这个**单文件状态栏**未同步，存在双标准不一致。
建议：抽出统一的 `countWords(text, locale)`：CJK 按字符计、西文按空格词计、中英混排两者相加；单文件栏与项目总览共用同一函数。

**3. 保存后 TipTap 整体重挂载，光标 + 撤销历史丢失** — [MarkdownEditor.tsx:14-19](apps/desktop/client/ui/src/features/editor/file-editor/MarkdownEditor.tsx#L14-L19) 监听 `savedContent` 递增 `revision`，`revision` 拼进 [TiptapEditor key](apps/desktop/client/ui/src/features/editor/file-editor/MarkdownEditor.tsx#L45)。保存会令 `savedContent = content`，于是**每次 Ctrl+S 都触发 remount**：光标跳回开头、undo 栈清空。写长稿时体验很伤。
建议：区分"自己保存"与"外部 reload/patch"。自己保存不触发 remount，仅外部内容变化才重建。

**4. 打开 `.md` 即往返转换，静默改写原文** — 打开时执行 `htmlToMarkdown(markdownToHtml(content))`，`marked → turndown` 往返非无损（缩进、列表符号、强调记号、换行被规范化）。用户没编辑文件就变"脏"，dirty 标记误触发，手稿格式被悄悄改动。
建议：打开时只 `markdownToHtml` 用于显示，保留原始 markdown 作为 baseline 比对，避免无操作变脏。

**5. 编码 / 换行无兜底** — `readFile`/`writeFile` 按裸字符串处理：无 BOM、无 GBK 检测、无 `\r\n`↔`\n` 归一。中文 `.txt` 常是 GBK，按 UTF-8 裸读会乱码；写失败 UI 也不提示。
建议：读入做编码探测（至少 UTF-8 / UTF-8-BOM / GBK），落盘统一 LF 或跟随原文件；写失败要在标签上回滚 dirty 并提示。

### 🟢 追加功能

- **自动保存** — 当前 `saveChaptersToProject` 已存在但无自动触发，标签只有 dirty 圆点。建议：空闲 N 秒 / 失焦自动保存正文文件，状态栏给"保存中 / 已保存 HH:MM / 保存失败"指示。
- **导出为 `.docx`** — 投稿 / 给编辑 / 出版的刚需。建议：用 `docx` 库（或 pandoc 旁路）把章节正文 / 合并稿导出为 Word，保留标题层级、分段、加粗斜体；入口放文件菜单 Export 与项目总览。
- **写作沉浸视图** — 当前段落高亮 / 打字机滚动 / 专注（禅）模式全无。这是写作工具区别于普通编辑器的关键，建议至少加：当前段落高亮、可选打字机居中滚动。
- **默认正文排版约束** — 默认 `.md` 文件编辑器无 max-width，全屏单行过长。建议正文统一首行缩进（中文 2 字符可选）、段间距、可读行宽（~720-780px）、CJK 衬线字体。

---

## 二、版本管理 / 时间线（git 包装）

### 现状

时间线 UI 在 [TimelinePanel](apps/desktop/client/ui/src/features/timeline/TimelinePanel.tsx)，底层走 [gitIpc.ts](apps/desktop/client/shell/main/ipc/gitIpc.ts)（isomorphic-git），Agent 侧另有 [gitHandlers.ts](apps/desktop/client/shell/main/ipc/toolHandlers/gitHandlers.ts) 工具层。

**已能用**（真实 git，非 mock）：
- 提交日志（跨分支、带 tag、按时间倒序）以 SVG DAG 渲染
- 列分支 / 当前分支 / 下拉切换分支（checkout branch）
- 从某 commit 创建分支
- 创建提交（"保存进度"按钮，message + 可选 tag，暂存全部改动）
- 点击 commit 看 diff（**仅文件列表 A/M/D，无内容 diff**）
- Agent 工具：`git_status` / `git_log` / `git_commit` / `git_diff`；commit 后自动刷新时间线

### 🔴 修改意见

**1. 有 commit 入口，但藏得深、语义不直观** — 你说"没有 commit 入口"，其实 [TimelinePanel.tsx:171-177](apps/desktop/client/ui/src/features/timeline/TimelinePanel.tsx#L171-L177) 的 "+" → "保存进度" 就是创建提交。问题是：① 它埋在时间线面板头部，不在顶栏 / 状态栏 / 命令面板（[commandRegistry](apps/desktop/client/ui/src/features/command-palette/commandRegistry.ts) 无 git 命令）；② 文案"保存进度"和正文 Ctrl+S"保存"概念易混。
建议：把"创建版本快照"提升为一等入口（状态栏常驻"●N 处改动 → 保存版本"、命令面板加 git 命令），与文件保存在措辞上明确区分（版本 / 快照 vs 保存）。

**2. 不能回到历史版本（核心缺失）** — 分支可切，但**没有 commit 级 checkout**。[gitIpc.ts](apps/desktop/client/shell/main/ipc/gitIpc.ts) 只有 `git:checkout-branch`，没有 checkout commit / restore / revert。`git:file-at-commit` IPC 已存在却从未被 UI 调用。用户无法"回到上一版"——对作者这是版本管理最常用的操作。
建议：commit 右键菜单加"恢复到此版本"（可选：检出到 detached 预览 / 或把某 commit 的文件 restore 到工作区 / 或新建分支）；并复用已有的 `git:file-at-commit` 做单文件回滚。

**3. 切分支无脏工作区保护** — [gitIpc.ts:165](apps/desktop/client/shell/main/ipc/gitIpc.ts#L165) 直接 `git.checkout`，工作区有未提交改动时会抛错，无 stash / 强制选项 / 提示。
建议：切换前检测 dirty，提示先"保存版本"或自动 stash，避免直接报错。

**4. diff 只有文件名，无内容对比** — `gitCommitDiff` 只返回 A/M/D 列表。作者看版本最想看的是"这一版改了哪些字"。
建议：点文件用 `git:file-at-commit` 取两版内容，做正文友好的对比（按段 / 按句的增删高亮，而非代码行 diff）。

### 🟢 追加功能

- **工作区改动 diff** — 当前无 `git:working-copy-diff`，看不到"自上次保存以来改了什么"。建议加未提交改动预览。
- **可配置提交身份** — 现在硬编码 `Orison <user@orison.local>` / `Orison Agent`。建议用用户偏好里的笔名 / 邮箱。
- **"展开全画布"是 stub** — [TimelinePanel](apps/desktop/client/ui/src/features/timeline/TimelinePanel.tsx) 那个按钮 disabled + "即将推出"，需排期或移除。
- （超出本地范畴，按需）merge / 远程 push-pull 目前完全没有，若不做云同步可暂不规划。

---

## 三、选段 → Agent（AI 评阅 / 引用）

### 现状

- Agent 输入区 [AgentInput.tsx](apps/desktop/client/ui/src/features/agent-panel/AgentInput.tsx) 的附件是**整章 / 整个打开文件**，类型 `{ type: 'chapter' | 'file'; id; label }`（[AgentInput.tsx:14](apps/desktop/client/ui/src/features/agent-panel/AgentInput.tsx#L14)），且只是**本地 React state**，发送时拼成 `[Attached chapter: xxx]` 纯文本前缀（[AgentInput.tsx:63-76](apps/desktop/client/ui/src/features/agent-panel/AgentInput.tsx#L63-L76)），不进 store、不带内容、不带定位。
- `sendAgentMessage` 会自动把**当前章前 1500 字**作为上下文前缀（[agentSessionSlice.ts:70-76](apps/desktop/client/ui/src/shared/store/agentSessionSlice.ts#L70-L76)）——有隐式整章上下文，但**没有选段级**通路。
- 编辑器右键菜单里 [ScriptEditor.tsx:22-23](apps/desktop/client/ui/src/features/editor/ScriptEditor.tsx#L22-L23) 的 "AI 续写 / AI 润色" 是 `disabled: true` 的占位 stub，没接通。
- `AgentMessage` 模型（[agentSessionSlice.ts](apps/desktop/client/ui/src/shared/store/agentSessionSlice.ts)）只有 role/content/toolCalls/toolResults，**不携带 references**。

### 🟢 追加功能（这是你想要的新能力，目前基本为零）

目标交互：**选中一段正文 → 右键 → "AI 评阅" → 把这段文本 + 来源索引作为 attachment 进 Agent → 展开讨论**。落地需要这几步：

**1. 捕获选段 + 来源索引** — 在 TipTap 里取当前 selection 文本与位置（chapterId / 文件路径 + 字符 range）。建议在编辑器侧暴露一个 `getSelectionRef()`：
```ts
type SelectionRef = {
  type: 'selection';
  text: string;                 // 选中的正文
  sourceLabel: string;          // 如 "第3章 · 选段"
  chapterId?: string;
  filePath?: string;
  range: { from: number; to: number };
};
```

**2. 扩展 Attachment 模型，并提升到 store** — 现在的 `Attachment` 加 `'selection'` 类型，带 `text` 与定位；从本地 state 提到全局 store，让"编辑器右键"和"输入区附件"都能往同一处塞 attachment。

**3. 右键菜单加"AI 评阅 / 加入对话"** — 通过已有的 `extraContextItems` 通道（ScriptEditor 已经在用）注入：
- "AI 评阅"：把选段作为 **structured attachment** 挂上并发起一条消息，**不在 UI 里写评阅话术**——评阅该做什么交给 agent 的 skill / runtime 发挥（见下方设计修正）
- "加入 Agent 引用"：只把选段作为 attachment 挂上，不立即发送，等用户自己补充问题

**4. attachment 在消息里可视化为引用块** — 发送后在消息流里把选段渲染成可点击的引用卡（显示来源"第3章"、点击跳回原位），而不是现在的 `[Attached ...]` 纯文本。需给 `AgentMessage` 增加 `references?: SelectionRef[]`。

**5. 结构化传给后端** — 见下方"设计修正：评阅行为归属"。选段作为结构化 attachment 进入消息通道，由 runtime 注入上下文，让 skill / runtime 决定行为。

### ★ 设计修正：评阅行为归属 agent，不在 UI 硬编码

**错误做法（已废弃）**：右键"AI 评阅"挂选段 + 在 UI 拼一段固定评阅 prompt 直接发。
**正确做法**：UI 只负责"把选段作为带出处的结构化 attachment 传给 agent"，**评阅逻辑由 agent 侧的 skill 或 runtime system prompt 决定**。UI 给上下文，agent 决定怎么评、评什么。

代码现状约束（已核实）：
- `agent:stream-message` 只收 `{ sessionId, content: string }`（[agentIpc.ts:110](apps/desktop/client/shell/main/ipc/agentIpc.ts#L110)），**没有结构化 attachment 通道**——这正是现在把附件拍平成 `[Attached ...]` 文本的原因。
- 现有 `referenceIds` 是**文件路径型**引用（[referenceResolver.ts:25-42](apps/desktop/agent/src/skill/runtime/referenceResolver.ts#L25-L42) 走 `readFile`）。**编辑器实时选段不是文件**，不能直接套 `referenceIds`，应作为消息级 attachment 传。

因此选段评阅的后端通路（替代原步骤 F）：
1. **扩展 `streamMessage` 通道**：`{ sessionId, content, attachments?: SelectionAttachment[] }`，沿 IPC 透传到 runtime。
2. **runtime 注入上下文**：在 context builder / system 段把 attachments 渲染成结构化引用块（含 quote + 来源 chapterId/filePath + 锚点），让 LLM 看到"用户在讨论这一段"。
3. **行为交给 agent**：是调用某个"评阅 skill"、还是直接对话讨论、还是提议改写并调 `rewrite_passage`，由 agent 自主决定。
4. **评阅 skill（可选，后续）**：若要更结构化的评阅，新建一个 review skill（SKILL.md 目录格式），通过 skill 工具被 LLM 自行召唤；本批次先不强依赖它，只保证 attachment 通路打通即可。

> 即"AI 评阅"按钮 ≈ "把这段连同出处发给 agent，并让它进入评阅心智"。心智的来源是 agent 的 system prompt / skill，而非 UI 模板。

### 已确认的设计决策

1. **回写粒度 = 选段级（方案 B）**：新增选段写工具，不整章重吐。
2. **范围 = 一步到位**：评阅 + 对话讨论 + 回写正文一起做。
3. **锚点漂移 = 候选高亮确认**：原文被改动找不到精确锚点时，高亮当前最接近的候选段让用户确认，而非简单报错重选。
4. **评阅行为归属 agent**：UI 只传选段 attachment，评阅逻辑在 skill / runtime（见上）。

### ⚠️ 实施前必须先理顺的现状断点

`chapter_write` 工具**无条件直接落盘**（[chapterHandlers.ts:64](apps/desktop/client/shell/main/ipc/toolHandlers/chapterHandlers.ts#L64)），工具执行层 [toolExecution.ts:101](apps/desktop/client/shell/main/ipc/toolExecution.ts#L101) 不做模式门控；且只返回 `{ wordCount }`，**不返回 `content`**。而 UI 的 pendingDiffs 路径要 `meta.content` 才生成 diff 卡片（[agentSessionSlice.ts:135](apps/desktop/client/ui/src/shared/store/agentSessionSlice.ts#L135)、[DiffCard.tsx:23](apps/desktop/client/ui/src/features/agent-panel/DiffCard.tsx#L23)）。两者对不上——现有整章 diff 走的是 `confirm_required` 门控 + 落盘后 `chapter:changed` 重载，而非 pendingDiffs 卡片。

**结论**：选段回写**绝不能在工具里直接落盘**。必须改成"工具只返回 `{ 改写文本 + 锚点 }` 作为 metadata → 客户端生成 passage diff 卡片 → 用户 Accept 时才由客户端拼接并保存"。这是与现有架构对齐的唯一正确路径。

### 落地步骤（一步到位，按依赖排序）

**A. 选段捕获（编辑器侧）**
- TipTap 暴露 `getSelectionRef()`：取 selection 纯文本 + 构造 `SelectionAnchor{ quote, prefix, suffix, rangeHint }`。
- ScriptEditor（章节）带 `chapterId`，MarkdownEditor（文件）带 `filePath`。

**B. 模型升级（store）**
- `Attachment` 加 `'selection'` 变体；从 AgentInput 本地 state 提升到全局 store（编辑器右键与回形针共用）。
- `AgentMessage` 加 `references?: Attachment[]`，消息流渲染可点击引用卡（点击跳回原文）。

**C. 右键入口（走 `extraContextItems`）**
- "AI 评阅"：挂选段 attachment 并发起消息，**UI 不写评阅话术**（行为归 agent，见上）。
- "加入 Agent 引用"：只挂 attachment 不发送。
- 同时把 ScriptEditor 现有的 disabled 占位项 [ScriptEditor.tsx:22-23](apps/desktop/client/ui/src/features/editor/ScriptEditor.tsx#L22-L23) 接通或移除。

**D. 选段写工具（agent + 工具层）**
- 新增 `rewrite_passage`，入参 `{ chapterId | filePath, anchor, replacement }`。
- **不落盘**，返回 `metadata: { type: 'passage', chapterId/filePath, anchor, replacement, originalQuote }`。
- `WRITE_TOOLS` 流式分支识别 `type: 'passage'` → 生成 passage 型 pendingDiff。

**E. passage diff 卡片 + 回写（store + UI）**
- `PendingDiff` 扩展支持 passage 型：`{ kind: 'passage', chapterId?, filePath?, anchor, replacement }`。
- DiffCard 对 passage 型只显示"原选段 → 新选段"对比（不显示整章）。
- `acceptDiff` 对 passage 型：**accept 时刻**用 `anchor.quote` 在**当前最新正文**里重定位 → 唯一命中直接拼接 `before+replacement+after`；多处命中用 prefix/suffix/rangeHint 消歧；找不到则进**候选高亮确认**流程（高亮最相近段落让用户确认目标），确认后再拼接保存。
- 章节型经 `updateChapter` + `saveChaptersToProject`；文件型经 `updateFileContent` + 文件保存。

**F. attachment 通道透传（IPC + runtime）**
- 扩展 `agent:stream-message` 与 `streamMessage` 接收 `attachments?: SelectionAttachment[]`（不是把选段拍平成文本）。
- runtime 的 context builder 把 attachments 渲染成结构化引用块注入上下文（quote + 出处 + 锚点）。
- 评阅/讨论/改写的具体行为由 agent system prompt / skill 决定，UI 不干预。

### 验证清单（"仔细检查流程"对应项）
- [ ] suggest 模式：评阅讨论多轮后产出 passage diff，Accept 才落地，Reject 不动正文
- [ ] auto 模式：是否允许选段改写直接应用（建议仍走确认，避免误改正文）
- [ ] 锚点漂移：讨论期间用户在别处编辑 → accept 仍定位正确；删除/改动原选段 → 触发候选高亮确认
- [ ] 多处相同文本：prefix/suffix/rangeHint 能正确消歧
- [ ] 引用卡点击跳回：章节与文件两类来源都能跳回原位
- [ ] 取消/中断：流式中断时 attachment 与 pendingDiff 状态不残留

---

## 建议处理顺序

1. **正文 #1（.txt 可编辑）、#2（中文字数）、#3（保存 remount）** — 直接影响日常写作，且都是确定性 bug。
2. **选段 → Agent（三章追加功能）** — 你明确想要的新能力，从 #1 捕获选段 + #3 右键"AI 评阅"切入最快见效。
3. **版本管理 #2（回到历史版本）+ #1（commit 入口前移）** — 把版本管理补成真正可用。
4. **自动保存 + docx 导出** — 完善正文工作流闭环。
5. **沉浸视图 / 排版约束 / diff 内容对比** — 体验打磨层。


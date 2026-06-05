# 实现计划：选段 → Agent + 版本管理

## 前置：移除 PlainTextEditor，.txt 改用 MarkdownEditor

- 删除 `PlainTextEditor.tsx`
- `FileEditor.tsx` / `SplitFileEditor.tsx` 中 `.txt/.text/空扩展名` 路由到 `MarkdownEditor`
- 删除 `file.css` 中 `.file-editor-plain` 和 `.plain-editor-textarea` 样式

## A. 选段 → Agent

### A1. 右键菜单入口（ScriptEditor + MarkdownEditor 共用）

TiptapEditor 已有 `extraContextItems` prop + 右键菜单基础设施。

**改动文件：**
- `TiptapEditor.tsx` — 新增 `onSelectionAction?: (action: 'review' | 'attach', selection: {text, from, to}) => void` prop；右键菜单增加"AI 评阅"和"加入 Agent 引用"两项（仅有选中文本时启用）
- `ScriptEditor.tsx` — 传入 `onSelectionAction`，构造 `SelectionAttachment`（sourceType='chapter'），调用 store
- `MarkdownEditor.tsx` — 同理（sourceType='file'）

**"AI 评阅"行为：** 打开 Agent 面板 + 挂 attachment + 自动发送预设 prompt（"请评阅以下选段"）
**"加入引用"行为：** 打开 Agent 面板 + 只挂 attachment，不发送

### A2. Agent 侧 rewrite_passage 工具

**改动文件：**
- `apps/desktop/agent/src/tool/builtin.ts` — 注册 `rewrite_passage` 工具（参数：chapterId | filePath, originalText, replacement）
- `apps/desktop/agent/src/runtime/permission.ts` — 把 `rewrite_passage` 加入 write class pattern

工具行为：不落盘，返回 metadata `{ type: 'passage', chapterId?, filePath?, originalText, replacement }`。
已有的 `WRITE_TOOLS` 列表已包含 `rewrite_passage`。

### A3. agentSessionSlice 处理 passage 型工具结果

**改动文件：**
- `agentSessionSlice.ts` — 在 `tool-result` 事件处理中，识别 `rewrite_passage` 工具的 metadata，生成 `PassagePendingDiff`

agentDiffSlice 已有完整的 `PassagePendingDiff` 类型和 `acceptDiff` 逻辑（含锚点重定位 + 候选确认）。只需在 session slice 的 stream handler 中正确生成它。

### A4. i18n

- `zh-CN/creative.yaml` 加 `editor.aiReview: "AI 评阅"` + `editor.addToAgent: "加入 Agent 引用"`
- `en-US/creative.yaml` 同步

## B. 版本管理

### B1. 状态栏 commit 入口

**改动文件：**
- `StatusBar.tsx` — 加"● N 处改动 → 保存版本"按钮
- `statusbar.css` — 加对应样式
- i18n — `statusBar.changes: "{n} 处改动"` / `statusBar.saveVersion: "保存版本"`

点击行为：弹 inline input 输入 message → 调用 `gitCreateNode`。

需要新增 git status 查询能力：
- `gitIpc.ts` — 新增 `git:status-count` handler（返回 dirty file count）
- `preload/index.ts` — 暴露 `gitStatusCount`
- `shared-contracts/ipc.ts` — 加类型
- `shared/api/git.ts` — 加 `gitStatusCount` 函数

### B2. commit 右键 → 新建分支检出（恢复到历史版本）

**改动文件：**
- `TimelinePanel.tsx` — commit 行增加"恢复到此版本"按钮
  - 行为：`gitCreateBranch(dir, auto-name, oid)` + `gitCheckoutBranch(dir, name)` → 刷新时间线

### B3. 切分支 dirty 保护

**改动文件：**
- `TimelinePanel.tsx` — 切分支前调用 `gitStatusCount`，若 > 0 弹确认对话框（"有未保存改动，请先保存版本"）

### B4. 命令面板 git 命令

**改动文件：**
- `commandRegistry.ts` — 新增 `saveVersion` 命令（等价于状态栏按钮）
- 调用方传入对应 handler

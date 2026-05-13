# Orison Space — UI 层级结构

本文档描述桌面端工作区的完整 UI 组件层级，用于对接和展示。

## 顶层页面

| 页面 | 组件 | 路径 |
|------|------|------|
| 登录/注册 | `AuthPage` | `pages/auth/` |
| 项目管理 | `ProjectsPage` | `pages/projects/` |
| 工作区 | `WorkspacePage` | `pages/workspace/` |

## 工作区布局总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                          TopBar                                      │
├──────┬──────────┬──────────────────────────┬────────────────────────┤
│ Icon │ Project  │                          │                        │
│ Rail │ Tree /   │      EditorArea          │     Agent Panel        │
│      │ Search   │      (FileTabBar)        │     (全高独立)          │
│      │ Panel    │      (FindReplaceBar)    │                        │
│      │ (互斥)   ├──────────────────────────┤                        │
│      │          │      BottomPanel         │                        │
│      │          │  (props/tasks/out/time)  │                        │
└──────┴──────────┴──────────────────────────┴────────────────────────┘
```

## 组件层级树

```
App
├── AuthPage
├── ProjectsPage
│   ├── ProjectHeader
│   ├── ProjectGrid (RecentProjectCard[])
│   └── NewProjectDialog
└── WorkspacePage
    └── WorkspaceLayout
        ├── TopBar
        │   ├── MenuBar (文件/编辑/视图/帮助)
        │   └── WindowControls (最小化/最大化/关闭)
        ├── SideNav (Icon Rail)
        │   ├── ExplorerBtn (资源管理器，切换左侧面板)
        │   ├── SearchBtn (搜索，切换左侧面板)
        │   ├── NavItem[] (outline/novel|script — 模块切换)
        │   ├── ModuleTabItem[] (storyboard/imageGen/video — 打开编辑区 tab)
        │   ├── AgentToggle (toggle 右侧 Agent Panel)
        │   ├── SettingsBtn
        │   └── AccountBtn
        ├── 左侧面板 (互斥，由 activeSidebarPanel 控制)
        │   ├── ProjectTree (activeSidebarPanel='explorer')
        │   └── SearchPanel (activeSidebarPanel='search')
        ├── workspace-main (flex column)
        │   ├── EditorArea
        │   │   ├── FileTabBar
        │   │   │   └── FileTab[] (文件 tab + 模块 tab 并存)
        │   │   ├── FindReplaceBar (Ctrl+F/H)
        │   │   ├── CommandPalette (Ctrl+Shift+P / Ctrl+P)
        │   │   └── Editor (按 tab 类型切换)
        │   │       ├── TiptapEditor (markdown)
        │   │       ├── OutlineEditor
        │   │       ├── ScriptEditor
        │   │       ├── VideoEditor (模块 tab)
        │   │       ├── ImageGenEditor (模块 tab)
        │   │       ├── StoryboardCanvas (模块 tab)
        │   │       └── FileEditor (通用文本)
        │   └── BottomPanel (可折叠)
        │       ├── Tab: Properties
        │       ├── Tab: Tasks
        │       ├── Tab: Output
        │       └── Tab: Timeline
        └── AgentPanel (可折叠，全高)
            ├── AgentPanel header
            │   ├── Title ("Agent")
            │   ├── NewConversation btn
            │   └── History btn
            ├── AgentMessages (消息流，auto-scroll)
            │   ├── AgentMessageItem (role=user)
            │   ├── AgentMessageItem (role=assistant)
            │   │   └── AgentToolCallBadge[]
            │   └── AgentMessageItem (role=tool)
            │       ├── AgentToolCard (普通 tool 结果)
            │       └── DiffCard (写入类 tool 结果)
            │           ├── Header (fileName + status)
            │           ├── Body (diff preview)
            │           └── Actions (Accept / Reject)
            ├── AgentConfirmCard (pendingToolConfirm 时显示)
            ├── AgentInput
            │   ├── Toolbar
            │   │   ├── Model select (下拉框)
            │   │   └── Mode select (下拉框: Read/Suggest/Auto)
            │   ├── Textarea (消息输入)
            │   └── Send/Stop btn
            └── AgentHistory (历史列表 overlay)
                └── HistoryItem[] (title + date + messageCount + delete)
```

## 组件名称对照表

| 组件名 | 文件路径 | 职责 |
|--------|----------|------|
| `TopBar` | `features/top-bar/TopBar.tsx` | 自定义标题栏 + 菜单 + 窗口控制 |
| `SideNav` | `features/side-nav/SideNav.tsx` | 左侧图标导航栏 |
| `ProjectTree` | `features/project-tree/ProjectTree.tsx` | 项目文件树 |
| `SearchPanel` | `features/search-panel/SearchPanel.tsx` | 搜索面板（与 ProjectTree 互斥） |
| `EditorArea` | `features/editor/EditorArea.tsx` | 编辑器容器 + 标签栏 |
| `FileTabBar` | `features/editor/FileTabBar.tsx` | 文件标签栏 |
| `FindReplaceBar` | `features/editor/FindReplaceBar.tsx` | 查找替换栏 |
| `CommandPalette` | `features/command-palette/CommandPalette.tsx` | 命令面板 |
| `BottomPanel` | `features/bottom-panel/BottomPanel.tsx` | 底部面板容器 |
| `AgentPanel` | `features/agent-panel/AgentPanel.tsx` | Agent 面板主容器 |
| `AgentMessages` | `features/agent-panel/AgentMessages.tsx` | 消息流列表 |
| `AgentMessageItem` | `features/agent-panel/AgentMessageItem.tsx` | 单条消息渲染 |
| `AgentToolCard` | `features/agent-panel/AgentToolCard.tsx` | Tool 结果折叠卡片 |
| `DiffCard` | `features/agent-panel/DiffCard.tsx` | 写入类 diff 预览 + Accept/Reject |
| `AgentConfirmCard` | `features/agent-panel/AgentConfirmCard.tsx` | Tool 执行确认卡片 |
| `AgentInput` | `features/agent-panel/AgentInput.tsx` | 输入区 + 工具栏 |
| `AgentHistory` | `features/agent-panel/AgentHistory.tsx` | 历史对话列表 |
| `ResizeHandle` | `shared/components/ResizeHandle.tsx` | 面板拖拽调整手柄 |
| `WorkspaceLayout` | `widgets/layout/WorkspaceLayout.tsx` | 工作区 Grid/Flex 布局编排 |

## 布局实现

`WorkspaceLayout` 使用 CSS Grid + Flex 组合：

```
workspace-body (CSS Grid: icon-rail | sidebar-panel | resize | main-area)
  └── main-area (Flex row)
      ├── workspace-main (Flex column, flex:1)
      │   ├── workspace-content (flex:1) → EditorArea
      │   └── workspace-bottom-wrapper → BottomPanel
      └── AgentPanel (固定宽度, 全高)
```

左侧面板（ProjectTree / SearchPanel）由 `activeSidebarPanel` 状态控制互斥切换，类似 VSCode 的 Explorer / Search 面板。

Agent Panel 与 workspace-main 同级 flex 子项，因此不受 BottomPanel 高度影响，始终从顶部延伸到窗口底部。

## i18n 命名空间

所有 Agent 面板文本使用 `agent.*` 命名空间：

| Key | en-US | zh-CN |
|-----|-------|-------|
| `agent.title` | Agent | Agent |
| `agent.you` | You | 你 |
| `agent.agent` | Agent | Agent |
| `agent.placeholder` | Ask the agent... | 向 Agent 提问... |
| `agent.selectModel` | Select model | 选择模型 |
| `agent.modeReadonly` | Read | 只读 |
| `agent.modeSuggest` | Suggest | 建议 |
| `agent.modeAuto` | Auto | 自动 |
| `agent.send` | Send | 发送 |
| `agent.stop` | Stop | 停止 |
| `agent.accept` | Accept | 接受 |
| `agent.reject` | Reject | 拒绝 |
| `agent.applied` | Applied | 已应用 |
| `agent.resolved` | Resolved | 已处理 |
| `agent.newConversation` | New conversation | 新建对话 |
| `agent.history` | History | 历史记录 |
| `agent.noHistory` | No previous conversations. | 暂无历史对话。 |
| `agent.emptyHint` | Ask the agent anything about your project. | 向 Agent 提问关于你项目的任何问题。 |

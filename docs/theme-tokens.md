# 主题配色手册

面向设计师的配色系统说明。所有配色文件位于 `apps/desktop/client/ui/src/shared/themes/`。

修改 YAML → 运行 `buildThemes.ts`（或 dev server 自动热更新）→ 生成最终 CSS 变量。

---

## 文件一览

```
themes/
├── light.yaml          ← 亮色调色板（全局基础色）
├── dark.yaml           ← 暗色调色板
├── slots.yaml          ← 槽位定义（UI 区域 → 调色板的映射）
├── slots.light.yaml    ← 亮色专属槽位覆盖
└── slots.dark.yaml     ← 暗色专属槽位覆盖
```

### 两层设计

| 层 | 文件 | 职责 | 改什么时候动它 |
|----|------|------|----------------|
| 调色板 | `light.yaml` / `dark.yaml` | 定义全局色值（背景、文字、强调色等） | 想整体换色调时 |
| 槽位 | `slots*.yaml` | 把具体 UI 区域绑定到调色板 token | 想单独调某个区域的配色时 |

**语法**：槽位文件中用 `{token-name}` 引用调色板 token，构建时自动替换为对应主题的实际色值。

---

## 调色板参数

### 背景与表面层级

从浅到深的容器层次，用于区分界面纵深：

| 参数 | 用在哪里 |
|------|----------|
| `background` | 窗口最底层 |
| `surface` | 主内容区（编辑器、面板主体） |
| `surface-container-lowest` | 最浅容器（输入框内部、卡片） |
| `surface-container-low` | 次浅容器（侧边栏、标签栏） |
| `surface-container` | 中间层（工具栏、状态栏） |
| `surface-container-high` | 较深层（悬浮面板、下拉菜单） |
| `surface-container-highest` | 最深层（弹窗头部、选中高亮） |
| `surface-variant` | 变体表面（禁用区域、分组背景） |

> 相邻层级保持 3–5% 亮度差。亮色从白到灰递增，暗色从深黑到灰递增。

### 文字

| 参数 | 用在哪里 |
|------|----------|
| `on-surface` | 主文字（标题、正文） |
| `on-surface-variant` | 辅助文字（标签、占位符） |
| `on-accent` | 强调色按钮上的文字 |
| `primary` | 最高对比度文字/图标（Logo） |

### 强调色与语义色

| 参数 | 用在哪里 |
|------|----------|
| `accent` | 主强调色（选中态、主按钮、链接） |
| `accent-strong` | 加深强调（hover、重要标记） |
| `accent-soft` | 淡化强调（选中行背景、标签底色） |
| `error` | 错误/危险（删除按钮、错误文字） |
| `error-bg` | 错误提示条底色 |
| `success` | 成功状态 |
| `notice-bg` | 信息提示条底色 |

### 边框

| 参数 | 用在哪里 |
|------|----------|
| `border-default` | 结构分隔线（面板间、标签栏底部） |
| `border-subtle` | 弱分隔（卡片内部、次要分隔） |
| `outline-variant` | 装饰边框（输入框、卡片外框） |
| `outline` | 高对比边框（聚焦环） |

> `border-subtle` 比 `border-default` 再降 30–40% 透明度即可。

### 交互态

| 参数 | 用在哪里 |
|------|----------|
| `hover-overlay` | 通用悬停叠加（按钮、图标） |
| `menu-item-hover` | 菜单项悬停 |
| `file-item-hover` | 文件列表项悬停 |
| `active-indicator` | 当前激活项背景（侧边栏选中） |

> 亮色用深色半透明叠加，暗色用白色半透明叠加，透明度 5–15%。

### 阴影

| 参数 | 用在哪里 |
|------|----------|
| `shadow-soft` | 轻阴影（卡片静态） |
| `shadow-elevated` | 强阴影（弹窗、hover 提升） |

值为完整 CSS `box-shadow`，如 `0 12px 40px rgba(0,0,0,0.06)`。

### 其他

| 参数 | 用在哪里 |
|------|----------|
| `overlay-backdrop` | 模态弹窗遮罩 |
| `provider-dot-gcp` | GCP 标识圆点 |
| `provider-dot-anthropic` | Anthropic 标识圆点 |

---

## 槽位参数

槽位把 **具体 UI 区域** 绑定到调色板 token。改槽位只影响对应区域，不会波及全局。

### 侧边导航栏

| 槽位 | 映射到 | 控制什么 |
|------|--------|----------|
| `sidebar-bg` | `{surface-container-low}` | 整体背景 |
| `sidebar-icon` | `{on-surface-variant}` | 图标默认色 |
| `sidebar-icon-hover` | `{on-surface}` | 图标悬停色 |
| `sidebar-icon-active` | `{on-surface}` | 图标激活色 |
| `sidebar-item-hover` | `{hover-overlay}` | 项目悬停背景 |
| `sidebar-item-active` | `{active-indicator}` | 项目激活背景 |

### 项目目录树

| 槽位 | 映射到 | 控制什么 |
|------|--------|----------|
| `project-tree-bg` | `{surface-container-low}` | 面板背景 |
| `project-tree-item-hover` | `{file-item-hover}` | 文件项悬停 |
| `project-tree-item-text` | `{on-surface}` | 文件项文字 |

### Agent 对话面板

| 槽位 | 映射到 | 控制什么 |
|------|--------|----------|
| `agent-panel-bg` | `{surface-container-low}` | 面板背景 |
| `agent-panel-header-bg` | `{surface-container-low}` | 头部/底部工具栏 |
| `agent-panel-skills-bg` | `{surface-container}` | 技能列表区域 |
| `agent-panel-card-bg` | `{surface}` | 消息卡片 |
| `agent-panel-tail-bg` | `{surface-container}` | 尾部标签/角色标记 |

### 资产库

| 槽位 | 映射到 | 控制什么 |
|------|--------|----------|
| `assets-search-bg` | `{surface-container}` | 搜索框背景 |
| `assets-card-bg` | `{surface-container-lowest}` | 资产卡片 |
| `assets-chip-active-bg` | `{accent}` | 筛选标签激活背景 |
| `assets-chip-active-text` | `{on-accent}` | 筛选标签激活文字 |

### 输入控件

| 槽位 | 映射到 | 控制什么 |
|------|--------|----------|
| `input-bg` | `{surface-container}` | 默认背景 |
| `input-bg-focus` | `{surface-container-lowest}` | 聚焦背景 |
| `input-border` | `{outline-variant}` | 边框 |
| `input-border-focus` | `{accent}` | 聚焦边框 |
| `input-text` | `{on-surface}` | 输入文字 |
| `input-placeholder` | `{on-surface-variant}` | 占位符 |

### 底部面板（日志/控制台）

| 槽位 | 映射到 | 控制什么 |
|------|--------|----------|
| `bottom-panel-bg` | `{surface}` | 面板主体 |
| `bottom-panel-header-bg` | `{surface-container-low}` | 标签栏 |
| `bottom-panel-toolbar-bg` | `{surface-container-low}` | 工具栏 |
| `bottom-panel-tab-active-border` | `{accent}` | 激活标签下划线 |

### Diff 代码对比

| 槽位 | 默认值 | 控制什么 |
|------|--------|----------|
| `diff-add-bg` | `rgba(76, 175, 80, 0.1)` | 新增行 |
| `diff-add-bg-strong` | `rgba(76, 175, 80, 0.25)` | 已接受行 |
| `diff-remove-bg` | `rgba(244, 67, 54, 0.1)` | 删除行 |
| `diff-remove-bg-strong` | `rgba(244, 67, 54, 0.25)` | 已拒绝行 |

### 卡片

| 槽位 | 映射到 | 控制什么 |
|------|--------|----------|
| `card-bg` | `{surface-container-lowest}` | 卡片背景 |
| `card-border` | `{outline-variant}` | 卡片边框 |
| `card-bg-hover` | `{surface-container-low}` | 悬停背景 |

### Chip / Badge

| 槽位 | 映射到 | 控制什么 |
|------|--------|----------|
| `chip-bg` | `{surface-container-high}` | 标签背景 |
| `chip-text` | `{on-surface-variant}` | 标签文字 |

---

## 亮暗对照速查

| 参数 | 亮色 | 暗色 | 要点 |
|------|------|------|------|
| `background` | `#faf9f7` 暖白 | `#1a1c1b` 深灰绿 | 基底色调 |
| `accent` | `#6b7a6a` 灰绿 | `#8fa88e` 亮灰绿 | 暗色需提亮保证对比度 |
| `on-surface` | `#1a1c1b` 近黑 | `#e3e2e0` 近白 | 与背景形成足够反差 |
| `error` | `#c44444` 深红 | `#e57373` 浅红 | 暗色中红色需提亮 |
| `shadow-soft` | 透明度 0.06 | 透明度 0.3 | 暗底上阴影需更重 |

---

## 日常操作

| 想做什么 | 改哪个文件 |
|----------|------------|
| 把侧边栏换个底色 | `slots.yaml` → 改 `sidebar-bg` 的映射 |
| 暗色下侧边栏用不同底色 | `slots.dark.yaml` → 加一行 `sidebar-bg: {xxx}` |
| 亮色下侧边栏用不同底色 | `slots.light.yaml` → 加一行 `sidebar-bg: {xxx}` |
| 全局换一套绿色调 | `light.yaml` / `dark.yaml` → 改 `accent` 系列 |
| 新增一个 UI 区域的槽位 | `slots.yaml` 加定义 → CSS 中用 `var(--槽位名)` |

改完后：
1. 运行 `buildThemes.ts` 或等 dev server 热更新
2. 在界面中切换亮/暗/跟随系统，确认效果正常

---

## 用 Coding Agent 辅助配色

设计师可以直接让 coding agent（如 Claude Code、Cursor 等）读取本文档，由 agent 代为修改 YAML 参数。

### 工作方式

1. 让 agent 先阅读本文档（`docs/theme-tokens.md`）获取配色系统上下文
2. 用自然语言描述配色意图
3. Agent 定位到正确的文件和参数，完成修改
4. 运行构建验证效果

### 指令示例

| 你说 | Agent 会做什么 |
|------|----------------|
| "侧边栏背景加深一级" | 改 `slots.yaml` 中 `sidebar-bg` 从 `{surface-container-low}` → `{surface-container}` |
| "暗色模式下 Agent 面板用纯黑底" | 在 `slots.dark.yaml` 中加 `agent-panel-bg: {background}` |
| "全局强调色换成蓝色 #4a7fb5" | 改 `light.yaml` 中 `accent: #4a7fb5`，同步调整 `accent-strong`、`accent-soft` |
| "输入框聚焦时边框更明显" | 改 `slots.yaml` 中 `input-border-focus` 的映射或直接写色值 |
| "diff 新增行的绿色太浅了" | 改 `slots.yaml` 中 `diff-add-bg` 的 rgba 透明度 |

### 效果最好的指令写法

- **给具体色值**："accent 改成 `#4a7fb5`" — agent 直接改，零歧义
- **给方向 + 参照**："sidebar 背景比现在深一级" — agent 查表后升一级容器层次
- **给视觉意图**："暗色模式下对比度不够，文字看不清" — agent 会提亮 `on-surface` 或加深 `background`

避免过于模糊的指令（如"整体好看一点"），agent 会需要多轮确认。越具体越高效。

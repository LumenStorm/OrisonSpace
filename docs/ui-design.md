# Orison Space — UI 页面与元素设计文档

## 1. 页面总览

应用包含三个顶层页面：

| 页面 | 路径 | 触发条件 |
|------|------|----------|
| 登录/注册页 (AuthPage) | 启动默认 | 未登录（无 token） |
| 项目管理页 (ProjectsPage) | 登录后 | 已登录但未打开项目 |
| 工作区 (WorkspacePage) | 打开/新建项目后 | `currentProject` 不为空 |

---

## 2. 登录/注册页 (AuthPage)

### 布局
居中卡片式布局，背景使用应用主背景色。

### 元素

| 元素 | 说明 |
|------|------|
| 品牌标题 | "Orison Space" |
| 副标题 | 产品 tagline |
| 登录/注册切换 Tab | 两个按钮切换模式 |
| 邮箱输入框 | email 验证 |
| 密码输入框 | 最少 6 位 |
| 显示名称输入框 | 仅注册模式显示 |
| 错误提示 | 红色背景文字 |
| 提交按钮 | "Sign In" / "Create Account" |

---

## 3. 项目管理页 (ProjectsPage)

### 布局
顶部 header + 居中内容区，最大宽度 720px。

### 元素

| 元素 | 说明 |
|------|------|
| 品牌标题 | "Orison Space" |
| 用户信息 | 显示名称或邮箱 |
| 登出按钮 | 清除 token，返回登录页 |
| 新建项目按钮 | 弹出命名对话框，创建空白项目 |
| 打开项目按钮 | 调用系统文件选择器，选择本地项目目录 |
| 最近项目列表 | 显示历史打开过的项目 |

---

## 4. 工作区 (WorkspacePage)

### 整体布局

```
┌─────────────────────────────────────────────────────────┐
│  [Home] [+] [Open] [Save] [Export] | [Undo] [Redo]     │
│                   TopBar                                │
├──────────┬─┬──────────────────────┬─┬───────────────────┤
│          │↔│                      │↔│                   │
│ SideNav  │ │     EditorArea       │ │  Inspector  [▶]   │
│(260px    │ │     (flex: 1)        │ │  (300px 可拉伸)   │
│ 可拉伸)  │ │                      │ │                   │
│          │ │                      │ ├───────────────────┤
│          │ │                      │ │  TaskFeed         │
└──────────┴─┴──────────────────────┴─┴───────────────────┘
```

- 三栏网格：左侧导航 / 中间编辑区 / 右侧检查器+任务面板
- 左右面板均可拖拽调整宽度（ResizeHandle 组件，4px 拖拽条）
  - 侧栏宽度范围：180px ~ 400px，默认 260px
  - 检查器宽度范围：200px ~ 500px，默认 300px
- 检查器可折叠/展开（chevron 按钮），折叠后右侧显示展开按钮
- 窗口宽度 < 960px 时自动折叠检查器
- TopBar 固定顶部，包含：
  - Home 按钮（仅在项目打开时显示，点击返回项目选择页）
  - 操作按钮（新建/打开/保存/撤销/重做/设置）
- TopBar 同时作为自定义标题栏（隐藏原生标题栏），支持拖拽移动窗口
  - Windows/Linux：右侧显示最小化/最大化/关闭按钮
  - macOS：保留原生红绿灯，左侧 70px 占位避让

---

## 4. 左侧导航 (SideNav)

垂直模块切换，替代横排 Tab。

### 导航项

| 模块 | 图标 | 标识 | 说明 |
|------|------|------|------|
| 大纲 (Outline) | auto_stories | `story` | 故事结构：幕、冲突、节奏 |
| 剧本 (Script) | description | `script` | 场景、对白编辑 |
| 分镜 (Storyboard) | view_quilt | `storyboard` | 镜头卡片网格 |
| 视频 (Video) | movie_filter | `video` | 片段时间线、预览 |

### 交互
- 点击切换 `activeModule`，高亮当前项（左侧 4px 绿色边框 + 浅绿背景）
- 悬停时背景微变

---

## 5. 各模块编辑区设计

### 5.1 大纲模块 (Outline / Story)

对应数据模型：`ProjectDocument.story`

| 元素 | 数据字段 | 说明 |
|------|----------|------|
| 项目标题 | `story.title` | 可编辑文本 |
| Logline | `outline.logline` | 一句话概述 |
| 风格设定 | `outline.style` | 视觉/叙事/节奏/参考 |
| 幕列表 | `story.acts[]` | 可折叠卡片列表 |
| 幕卡片 | `act.id / title / summary` | 标题 + 摘要 + 冲突等级 |
| AI 生成按钮 | — | 提交 `story.rewrite` 任务 |

### 5.2 剧本模块 (Script)

对应数据模型：`ProjectDocument.script`

| 元素 | 数据字段 | 说明 |
|------|----------|------|
| 场景列表 | `script.scenes[]` | 左侧或顶部场景索引 |
| 场景编辑器 | `scene.title / summary` | 富文本编辑区 |
| 对白列表 | `scene.dialogues[]` | 角色 + 台词行 |
| 对白行 | `dialogue.character_id / line` | 角色名 + 对白内容 |
| AI 改写按钮 | — | 提交 `script.rewrite` 任务 |

### 5.3 分镜模块 (Storyboard)

对应数据模型：`ProjectDocument.storyboard`

| 元素 | 数据字段 | 说明 |
|------|----------|------|
| 镜头卡片网格 | `storyboard.shots[]` | 响应式网格，auto-fit |
| 镜头卡片 | `shot` | 包含以下子元素 |
| ├ 画面区域 | `shot.image_prompt` | 16:9 比例，AI 生成图或占位渐变 |
| ├ 序号徽章 | `shot.id` | 左上角半透明黑底白字 |
| ├ 描述文本 | `shot.description` | 卡片下方，2行截断 |
| └ 选中态 | — | 绿色边框 + 外发光 |
| 右侧检查器 | — | 选中镜头的参数编辑 |

#### 检查器参数（分镜模式）

| 参数 | 类型 | 选项 |
|------|------|------|
| 镜头焦距 (Camera Lens) | 下拉 | Macro / Portrait / Wide / Ultra-Wide |
| 画面比例 (Aspect Ratio) | 分段按钮 | 16:9 / 2.35:1 / 4:3 |
| 光影氛围 (Lighting Mood) | 下拉 | Natural / Golden Hour / Noir / Cinematic Blue |
| AI 生成区 | 文本框 + 按钮 | 描述细节 → "Render Frame" |

### 5.4 视频模块 (Video)

对应数据模型：`ProjectDocument.video` (扩展)

| 元素 | 数据字段 | 说明 |
|------|----------|------|
| 时间线 | `video.clips[]` | 水平时间轴，片段排列 |
| 片段块 | `clip.shot_id / start_time / end_time` | 可拖拽调整时长 |
| 预览窗口 | — | 播放选中片段 |
| AI 生成按钮 | — | 提交视频生成任务 |

---

## 6. 素材管理 (Assets)（规划中）

对应数据模型：`ProjectDocument.assets`

| 元素 | 数据字段 | 说明 |
|------|----------|------|
| 角色列表 | `assets.characters[]` | 角色卡片：名称 + 外观描述 |
| 场景列表 | `assets.scenes[]` | 场景卡片：名称 + 环境描述 |

---

## 7. 数据模型与页面对应关系

```
ProjectDocument
├── meta (id, name, version)          → TopBar 项目名显示
├── story / outline                   → 大纲模块
│   ├── title, logline, style         → 顶部编辑区
│   └── acts[]                        → 幕卡片列表
├── script                            → 剧本模块
│   └── scenes[]                      → 场景列表
│       └── dialogues[]               → 对白编辑
├── storyboard                        → 分镜模块
│   └── shots[]                       → 镜头卡片网格
├── video                             → 视频模块
│   └── clips[]                       → 时间线片段
└── assets                            → 素材管理
    ├── characters[]                  → 角色卡片
    └── scenes[]                      → 场景卡片
```

---

## 8. AI 交互流程

所有模块共享统一的 AI 任务流程：

```
用户操作 → 提交任务 (taskRequest)
         → 服务端处理 (queued → running)
         → 返回结果 (taskResult + patchOperations)
         → 用户审阅 (Inspector / TaskFeed 面板)
         → 接受 / 拒绝 → 合并到本地数据
```

任务类型按模块区分：
- `story.rewrite` — 大纲改写
- `script.rewrite` — 剧本改写
- `storyboard.generate` — 分镜图生成
- `video.generate` — 视频片段生成

---

## 9. 设计规范

| 项目 | 值 |
|------|-----|
| UI 字体 | Inter, Noto Sans SC, 400/500/600 |
| 内容字体 | Newsreader, Noto Serif SC, 400/500 |
| 图标 | Material Symbols Outlined |
| 主色调 | sage green #6B7A6A |
| 强调色 | #586657 |
| 背景色 | #FAF9F7 |
| 文字色 | #1A1C1B |
| 次要文字 | #464741 |
| 边框色 | rgba(199,199,191,0.7) |
| 圆角 | 0.25rem (小) / 0.5rem (中) / 1rem (大) |
| 阴影 | 0 12px 40px rgba(45,52,51,0.06) |
| 侧栏宽度 | 260px（可拉伸 180~400px） |
| 检查器宽度 | 300px（可拉伸 200~500px） |

> 注：以上颜色值为 light 主题默认值。所有颜色通过 CSS 自定义属性（`var(--token)`）引用，实际值由主题系统控制。

---

## 10. 主题系统

应用支持 light / dark 主题切换，以及跟随系统自动切换。

| 项目 | 说明 |
|------|------|
| 主题定义 | `themes/light.yaml` + `themes/dark.yaml`，YAML 定义所有 design token |
| 构建脚本 | `buildThemes.ts` 扫描 YAML 生成 `tokens.css` |
| CSS 选择器 | `:root` / `[data-theme="light"]` / `[data-theme="dark"]` / `[data-theme="system"]`（媒体查询） |
| 状态管理 | `appStore.theme`：`'system'` / `'light'` / `'dark'`，持久化到 localStorage |
| 扩展 | 新增 `themes/{name}.yaml` 即自动注册 |

---

## 11. 多语言 (i18n)

应用支持中文 (zh-CN) 和英文 (en-US)，根据系统语言自动选择。

| 项目 | 说明 |
|------|------|
| 语言包 | `i18n/zh-CN.yaml` + `i18n/en-US.yaml`，按模块分 namespace |
| Hook | `useI18n(locale)` — 提供 `t(key, vars?)` 和 `tArray(key)` |
| 检测 | Electron `getLocale()` → `navigator.language` → 回退 en-US |
| 状态管理 | `appStore.locale` / `appStore.resolvedLocale`，持久化到 localStorage |
| 扩展 | 新增 `i18n/{locale}.yaml` 即自动注册 |

所有用户可见文本均通过 `t()` 函数获取，不再硬编码。

---

## 12. 自定义标题栏

隐藏原生标题栏，TopBar 组件同时承担窗口控制功能。

| 平台 | 实现方式 |
|------|----------|
| Windows/Linux | `frame: false`，TopBar 右侧渲染最小化/最大化/关闭 SVG 按钮 |
| macOS | `titleBarStyle: 'hidden'`，保留原生红绿灯，TopBar 左侧 70px 占位 |

TopBar 整体设置 `-webkit-app-region: drag` 实现拖拽移动，按钮等交互元素设置 `no-drag`。

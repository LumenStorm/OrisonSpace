# Orison Space - Design.md

## 一、项目概述

Orison Space 是一款基于 Electron 的桌面应用，定位为：

> **AI驱动的影视创作 IDE（Director Workspace）**

目标是提供一个从创意到视频的完整创作工作流，支持用户从一句话开始，逐步构建：

- 故事大纲（Story）
- 小说 / 剧本（Novel / Script）
- 分镜（Storyboard）
- 视频（Video）

产品核心理念：

- 用户主导创作
- AI 辅助生成与优化
- 支持逐步编辑与可控修改（非一键生成）

---

注意：开发过程需要给生产环境做好准备


技术栈选用：
桌面壳：Electron
构建工具：electron-vite
前端框架：React
语言：TypeScript
本地状态管理：Zustand
服务端状态 / API 缓存：TanStack Query
样式系统：Tailwind CSS
富文本 / 大纲编辑：Tiptap
代码感 / 结构化文本编辑：Monaco Editor
表单校验：Zod
路由：React Router
数据持久化：本地 YAML + Markdown 文件保存创作内容；PostgreSQL 保存项目元数据、任务流水和资产索引
打包发布：先 electron-vite 开发，发布阶段接 Electron Forge 或 electron-builder

## 二、UI 架构

整体采用 IDE 风格三栏布局：


Top Bar（全局操作栏）
Left Panel（Project Tree）
Center Panel（Editor Workspace）
Right Panel（Inspector + AI）


---

### 2.1 Top Bar（顶部菜单栏）

采用经典桌面应用菜单栏风格，用文字引导替代纯图标：

菜单结构：

- 文件：新建项目 / 打开项目 / 保存 / 导出 / 返回项目列表
- 编辑：撤销 / 重做
- 视图：项目文件树 / 底部面板 / 设置 / 账户
- 帮助：关于 / 快捷键

设计要求：

- 左侧品牌名 + 四个下拉菜单 + 右侧窗口控制按钮
- 菜单项显示快捷键提示
- 整体可拖拽移动窗口（`-webkit-app-region: drag`）
- Windows/Linux 右侧显示窗口控制按钮，macOS 保留原生红绿灯

---

### 2.2 左侧：Icon Rail + Project Tree（导航与项目文件）

结构：

左侧分为两部分：
- **Icon Rail**（48px 固定宽度）：垂直图标按钮，按项目类型切换模块
- **Project Tree**（220px 可拉伸）：文件系统树，展示项目目录下的实际文件和文件夹

文件树中的已知文件夹/文件名通过 i18n 映射为用户友好的显示名：

| 原始名 | 中文显示名 | 英文显示名 |
|--------|-----------|-----------|
| chapters | 章节 | Chapters |
| scenes | 场景 | Scenes |
| assets | 素材 | Assets |
| project.yaml | 项目配置 | Project Config |

未映射的文件名保持原样显示。映射名悬停时 tooltip 显示原始文件名。


Project
├─ Outline
├─ Novel / Script（按项目类型）
├─ Storyboard
├─ Image Gen
├─ Video
├─ Assets
└─ Meta


要求：

- 树状结构
- 支持展开/折叠
- 支持拖拽排序
- 支持右键操作（新增/删除/重命名）
- 当前选中高亮

---

### 2.3 中间：Editor Workspace（主编辑区）

采用多标签页（Tabs）：


[Story] [Script] [Storyboard] [Video]


不同模块对应不同编辑模式：

#### Story
- 大纲结构（层级编辑）
- 支持 AI 扩展

#### Script
- 文本编辑器（剧本格式）
- 支持局部 AI 改写

#### Storyboard
- 卡片/画布结构
- 每个镜头为独立单元

#### Video
- 片段排列 / 简易时间轴

---

### 2.4 底部：BottomPanel（属性 / 任务 / 输出）

可折叠的底部面板，包含三个 Tab：

#### properties（属性检查器）
固定位置，内容动态变化

根据当前选中对象显示：

#### Story
- 节奏参数
- 风格控制

#### Script
- 角色 / 情绪 / 对话调节

#### Storyboard
- 镜头类型
- 摄影机运动
- 时长
- 风格

#### 无选中
- AI Assistant 输入面板

#### tasks（任务列表）
- 显示当前项目的任务流水
- 任务状态：queued → running → completed / failed

#### output（输出日志）
- 显示 AI 生成过程的日志输出

---

## 三、核心数据结构

采用 YAML/JSON 结构，支持“部分字段更新（Partial Update）”

---

### 3.1 Outline（大纲）

```yaml
outline:
  id: string
  title: string
  theme: string
  genre: string
  logline: string
  style:
    visual_style: string
    narrative_style: string
    pacing_style: string
    reference: string
  acts:
    - id: string
      title: string
      summary: string
      conflict_level: number
      pacing: number
3.2 Novel（小说）
novel:
  id: string
  chapters:
    - id: string
      title: string
      content: text
3.3 Script（剧本）
script:
  id: string
  scenes:
    - id: string
      title: string
      dialogues:
        - character_id: string
          line: text
3.4 Storyboard（分镜）
storyboard:
  id: string
  shots:
    - id: string
      description: string
      image_prompt: string
      duration: number
      camera_type: string
      camera_movement: string
3.5 Video（视频）
video:
  id: string
  clips:
    - shot_id: string
      start_time: number
      end_time: number
3.6 Assets（资产）
assets:
  characters:
    - id: string
      name: string
      appearance: text

  locations:
    - id: string
      name: string
      description: text
四、数据更新策略

采用 Partial Update（局部更新）

示例：

outline:
  style:
    visual_style: "anime"

规则：

未传字段保持原值
不强制完整结构
支持逐步构建数据
五、AI 交互设计

AI 深度嵌入各模块：

Story：生成/优化剧情
Script：改写对话
Storyboard：生成镜头
Video：生成片段

支持两种模式：

1. 按钮式操作
“更戏剧化”
“更紧凑”
2. 自然语言输入
让剧情更黑暗
增加一个反转
把这个镜头改成特写
六、核心原则
IDE化结构（左树 + 中编辑 + 右属性）
上下文驱动 UI（右侧动态变化）
数据渐进式构建（非一次性完整）
用户主导 + AI辅助
所有模块可编辑、可回溯
七、初期开发范围（MVP）

优先实现：

基础 UI 框架（Electron + 前端框架）
Project Tree
Story / Script / Storyboard 编辑器基础版
Inspector Panel（基础字段）
简单 AI 接口调用（mock 或 API）

---

## 八、主题与多语言

### 8.1 主题系统

- 支持 light / dark / system（跟随系统）三种模式
- 主题定义：`themes/light.yaml` + `themes/dark.yaml`，YAML 存储所有 design token
- 构建脚本 `buildThemes.ts` 自动扫描 YAML 生成 `tokens.css`
- CSS 通过 `[data-theme]` 选择器切换，所有颜色使用 `var(--token)` 引用
- 扩展：新增 `themes/{name}.yaml` 即自动注册

### 8.2 多语言 (i18n)

- 支持 zh-CN / en-US，根据系统语言自动选择
- 语言包：`i18n/zh-CN.yaml` + `i18n/en-US.yaml`，按模块分 namespace
- `useI18n` hook 通过 `import.meta.glob` 运行时自动扫描语言包
- `t(key, vars?)` 支持插值，`tArray(key)` 获取数组值
- 扩展：新增 `i18n/{locale}.yaml` 即自动注册

### 8.3 自定义标题栏

- 隐藏原生标题栏，TopBar 组件替代
- Windows/Linux：`frame: false`，TopBar 右侧渲染最小化/最大化/关闭按钮
- macOS：`titleBarStyle: 'hidden'`，保留原生红绿灯
- TopBar 整体 `-webkit-app-region: drag` 支持拖拽移动窗口
- TopBar 支持经典菜单栏（文件/编辑/视图/帮助），带键盘导航（Arrow/Enter/Escape）和全局快捷键（Ctrl+S/Z/N/O）
- 窗口控制通过 IPC 通道（`window:minimize` / `window:maximize` / `window:close`）

### 8.4 安全策略

- CSP 由主进程通过 `session.webRequest.onHeadersReceived` 动态注入（仅生产构建）
- 所有 IPC 文件操作通过 `pathGuard.ts` 校验路径范围；桌面项目文件操作限制在 `~/Documents/OrisonSpace` 项目范围内
- 图片生成文件操作仅允许写入项目内 `temp/images` 与 `assets/images`
- API Key 使用 Electron `safeStorage` API 加密存储
- `shell:show-item-in-folder` / `shell:open-path` 不再自动创建不存在的文件/目录
- 渲染层包裹 `ErrorBoundary`，防止未捕获异常导致白屏

---

## 九、协同开发规范

### 分支策略

- `main` — 稳定发布分支
- `dev` — 日常开发分支
- 功能分支从 `dev` 切出，命名 `feat/xxx` 或 `fix/xxx`

### 同步代码

拉取最新代码统一使用 `git remote update` + `git rebase`，保持提交历史线性：

```bash
git remote update
git rebase origin/dev
```

遇到冲突时：

```bash
git add <冲突文件>
git rebase --continue
```

> 禁止使用 `git pull`（默认产生 merge commit），避免污染提交历史。

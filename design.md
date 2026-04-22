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
数据持久化：先 YAML 本地文件，后期再加 SQLite
打包发布：先 electron-vite 开发，发布阶段接 Electron Forge 或 electron-builder

## 二、UI 架构

整体采用 IDE 风格三栏布局：


Top Bar（全局操作栏）
Left Panel（Project Tree）
Center Panel（Editor Workspace）
Right Panel（Inspector + AI）


---

### 2.1 Top Bar（顶部栏）

功能：

- 项目管理：New / Open / Save / Export
- 编辑控制：Undo / Redo
- 系统入口：AI Assistant / Settings / Help

设计要求：

- 简洁、工具化
- 支持状态反馈（保存中 / 生成中）

---

### 2.2 左侧：Project Tree（项目结构）

结构：


Project
├─ Story
├─ Script
├─ Storyboard
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

### 2.4 右侧：Inspector Panel（属性面板）

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

  scenes:
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
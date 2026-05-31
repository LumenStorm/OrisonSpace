# Orison Space 设计说明

## 一、项目定位

Orison Space 是一个基于 Electron 的桌面创作应用，目标是提供从创意到长篇内容、再到分镜和生成资产的完整工作流。

核心定位：

> AI 驱动的创作工作台，而不是一次性自动生成器。

设计原则：

- 用户主导创作
- AI 提供生成、补全、审阅与可控修改
- 本地项目文件是创作主存
- 桌面主进程负责模型调用与 Agent 编排
- 无独立服务端进程

## 二、当前总体架构

### 1. 桌面 UI

- React + TypeScript + Zustand
- 负责：
  - 项目管理
  - 工作区创作
  - 模型配置
  - 图片生成结果管理（画廊 / 预览 / 本地编辑弹窗）
  - Auto Mode 与任务输出展示
- 全局样式按文件夹分层（`shared/styles/` 下 `base/ layout/ editor/`），`global.css` 为唯一入口

### 2. 桌面主进程

- Electron shell / preload / IPC
- 负责：
  - 文件系统与路径安全
  - 模型配置读写
  - provider 模型列表刷新
  - 文本 / 图片生成
  - story-sync 本地执行
  - 用户偏好持久化
  - Agent workflow runtime（内嵌库）

### 3. Agent（库）

- 作为 `@orison/desktop-agent` 包内嵌于桌面主进程
- 负责编排、skill 执行、workflow runtime、continuation
- 不再是独立 HTTP 服务
- 不持有 provider `apiKey`
- 通过依赖注入获取 LLM 调用能力（由 shell 提供）

## 三、UI 总布局

桌面工作区采用 IDE 风格布局：

- 顶部 TopBar
- 左侧 Icon Rail
- 左侧 Project Tree
- 中间 EditorArea
- 底部 BottomPanel

当前页面分为两层：

- ProjectsPage
- WorkspacePage

## 四、模型配置设计

当前模型配置采用 key-based 结构：

- 一个 key = 一组 `name + baseUrl + apiKey`
- 一个 key 下有多个模型条目
- 每个模型条目有：
  - `id`
  - `alias`
  - `capability`
  - `enabled`

槽位选择为：

- `novel -> { keyId, modelId }`
- `image -> { keyId, modelId }`

### UI 交互状态

模型设置页当前分为：

- 无 key 的空状态
- 有 key 但未选择的占位状态
- 新建中状态
- 编辑已有 key 状态

## 五、模型网关设计

当前生成链路已迁移到桌面主进程：

- renderer -> preload
- preload -> IPC
- desktop main -> `@orison/model-protocols`
- desktop main -> provider

这样做的目标：

- `apiKey` 仅存在于桌面主进程
- `apiKey` 不进入 agent
- provider 适配逻辑统一收敛

当前支持的生成类型：

- 文本
- 图片

## 六、Story Sync 设计

Story Sync 现在是“两段式”：

1. desktop main 本地执行 story-sync 提取
2. agent 对补丁再次校验并在失败时回退规则

作用：

- 保留 LLM 提取能力
- 不让 agent 持有模型密钥
- 保持补丁安全边界

## 七、文件与数据设计

### 本地项目

本地项目目录负责：

- `project.yaml`
- `chapters/*.md`
- `scenes/*.md`
- `memory/story-memory.yaml`
- `temp/images/generation/*`
- `assets/images/*`

## 八、设计结论

当前系统是纯本地桌面应用：

- 桌面端拥有模型调用权
- Agent 作为库内嵌于桌面主进程，负责编排与 skill 执行
- 无独立服务端进程
- 本地项目文件继续作为创作真相源

这是目前代码实现对应的真实设计，而不是早期方案。

# Orison Space 设计说明

## 一、项目定位

Orison Space 是一个基于 Electron 的桌面创作应用，目标是提供从创意到长篇内容、再到分镜和生成资产的完整工作流。

核心定位：

> AI 驱动的创作工作台，而不是一次性自动生成器。

设计原则：

- 用户主导创作
- AI 提供生成、补全、审阅与可控修改
- 本地项目文件是创作主存
- 服务端负责认证、任务与编排代理
- 模型调用发生在用户机器上

## 二、当前总体架构

### 1. 桌面 UI

- React + TypeScript + Zustand
- 负责：
  - 登录 / 注册
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
  - 文本 / 图片 / 视频生成
  - story-sync 本地执行
  - 用户偏好持久化

### 3. 服务端

- Fastify
- 负责：
  - auth
  - project
  - task
  - orchestration proxy

### 4. Agent

- 负责编排、章节生成、自动模式推进、规则回退
- 不再持有 provider `apiKey`
- 不再直接请求第三方模型

## 三、UI 总布局

桌面工作区采用 IDE 风格布局：

- 顶部 TopBar
- 左侧 Icon Rail
- 左侧 Project Tree
- 中间 EditorArea
- 底部 BottomPanel

当前页面分为三层：

- AuthPage
- ProjectsPage
- WorkspacePage

## 四、鉴权设计

当前鉴权行为：

- 本地缓存 token 与 user
- 应用启动时执行 `bootstrapAuth`
- 若有 token，先调用 `/v1/auth/me`
- 401：清空会话并回到登录页
- 非 401：进入匿名态并显示错误
- 成功：同步最新 user，再进入项目页 / 工作区

这意味着：

- 不再只凭本地 token 是否存在决定入口页面
- 不再出现“过期 token 先进入项目页”的问题

## 五、模型配置设计

当前模型配置采用 profile + models[] 结构：

- 一个 profile = 一组 `provider + baseUrl + apiKey`
- profile 下有多个模型条目
- 每个模型条目有：
  - `id`
  - `alias`
  - `apiFormat`
  - `capabilities`

槽位选择为：

- `novel -> { profileId, modelId }`
- `image -> { profileId, modelId }`
- `video -> { profileId, modelId }`

### UI 交互状态

模型设置页当前分为：

- 无 profile 的空状态
- 有 profile 但未选择的占位状态
- 新建中状态
- 编辑已有 profile 状态

## 六、模型网关设计

当前生成链路已迁移到桌面主进程：

- renderer -> preload
- preload -> IPC
- desktop main -> `@orison/model-protocols`
- desktop main -> provider

这样做的目标：

- `apiKey` 不经过 server
- `apiKey` 不进入 agent
- provider 适配逻辑统一收敛

当前支持的生成类型：

- 文本
- 图片
- 视频（接口已在，部分 adapter 仍为占位）

## 七、Story Sync 设计

Story Sync 现在是“两段式”：

1. desktop main 本地执行 story-sync 提取
2. agent 对补丁再次校验并在失败时回退规则

作用：

- 保留 LLM 提取能力
- 不让 agent 持有模型密钥
- 保持补丁安全边界

## 八、文件与数据设计

### 本地项目

本地项目目录负责：

- `project.yaml`
- `chapters/*.md`
- `scenes/*.md`
- `memory/story-memory.yaml`
- `temp/images/generation/*`
- `assets/images/*`

### 服务端数据库

数据库负责：

- `users`
- `projects`
- `tasks`
- `task_asset_refs`
- `project_assets`

## 九、设计结论

当前系统已经不是“服务端统一中转模型请求”的设计，而是：

- 桌面端拥有模型调用权
- 服务端只负责认证、任务和代理
- agent 只做编排与规则逻辑
- 本地项目文件继续作为创作真相源

这是目前代码实现对应的真实设计，而不是早期方案。

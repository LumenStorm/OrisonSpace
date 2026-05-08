# 模块边界与拆分规则

> 状态：当前生效中的架构规则文档。只要 UI、桌面 IPC、服务端职责或存储边界发生变化，就要同步更新这里。

## 目标

- 让页面、功能模块、服务层、模型协议层都能独立理解
- 让 UI 文件专注于渲染与交互，不混入文件系统、provider 协议或复杂 payload 拼装
- 让后端和桌面主进程的边界稳定，便于替换实现而不破坏契约
- 优先强调明确的模块所有权，而不是继续堆大型混合文件

## 桌面 UI

- 渲染层遵循 `app -> pages -> widgets -> features -> shared` 的分层约定。
- 高层可以依赖低层，低层不能反向依赖高层。
- `src/app/*` 只负责应用根部组合：
  - 顶层页面切换
  - 全局 bootstrap effect
  - 顶层错误边界和壳层拼装
- `src/pages/*` 是页面级入口文件：
  - 可以组合 feature / widget / shared
  - 不应该承载重度领域逻辑、复杂 payload 转换或 provider 逻辑
- `src/widgets/*` 承载跨 feature 的页面级外壳与复用块，例如：
  - `widgets/layout/WorkspaceLayout.tsx`
  - `widgets/projects/*`
- `src/features/<domain>/*` 拥有具体产品域，例如：
  - editor
  - project-tree
  - orchestration
  - novel workbench
  - memory
  - auto mode
- 一个 feature 的入口组件应主要负责：
  - 状态选择
  - 子视图编排
  - 页面局部布局
- 子视图、局部 hook、纯工具函数、局部类型，只要具备独立职责，就应拆到独立文件。
- 纯渲染辅助、树结构处理、路径转换、排序、payload 构建，不应直接写在 JSX render 体里。
- 通用 UI 原语放在 `src/shared/components`
- 只属于某个业务域的组件，放回对应 feature 内部
- 被多个 feature 复用的 schema / 验证辅助，放在 `src/shared/<domain>/`
- 所有 HTTP 请求统一放在 `src/shared/api/*.ts`
  - slice 和组件只能调这些 helper
  - 不直接在组件或 slice 中写 `fetch`
- store 采用 slice 化组织：
  - `appStore.ts` 只组合 slice
  - 每个 slice 自己维护状态与状态迁移
- 当前鉴权启动逻辑已经收口到 `authSlice.bootstrapAuth()`：
  - `App` 不直接负责 session 校验细节
  - `App` 只消费 `authStatus`
- 用户可见文案统一走 `t()`，禁止新增硬编码显示文本

### 样式文件组织

- `src/shared/styles/` 采用文件夹分层，不再堆叠在单一目录
  - `tokens.css` / `global.css` 保留在根
  - `base/` 存放基础原语（`components.css` `welcome.css`）
  - `layout/` 存放应用外壳样式（`workspace.css` `topbar.css` `sidebar.css` `pages.css`）
  - `editor/` 存放编辑器相关样式（`tiptap.css` `script.css` `video.css` `image-gen.css` `image-dialog.css` `novel.css` `file.css`）
  - 叶子文件 `inspector.css` / `creative.css` 暂留根目录
- `global.css` 是唯一入口，按顺序 `@import` 其他文件
  - 级联顺序必须保留：`.image-gen-inspector-*` 必须排在 `.image-gen-*` 之后、`components.css` 保持在所有 editor 样式之后
  - 调整文件位置时不允许顺手改 `@import` 顺序
- 下游消费方只 import `@desktop-ui/shared/styles/global.css`，不能跨层单独 import 子文件
- 新增样式需归入上述文件夹；不要在根再新建扁平 CSS 文件

## 桌面 Shell 与 IPC

- IPC 契约定义在 `packages/shared-contracts/src/ipc.ts`
- 渲染层只能通过 preload API 与主进程交互
- 渲染层不得直接导入 Electron 或 Node 文件系统 API
- `shell/main/ipc/*Ipc.ts` 以能力划分 handler
- 共用校验逻辑放辅助文件，例如 `pathGuard.ts`
- 文件与 shell 操作都必须先通过路径安全校验
- 生成图片文件只能写入项目内允许目录，例如：
  - `temp/images/generation`
  - `assets/images`
- 新项目默认根目录：`~/Documents/OrisonSpace`
- 用户主动选择的项目目录和封面图路径，会在当前 Electron 会话里注册为允许根

## 模型配置与桌面模型网关

- 模型配置使用 v2 结构：
  - `~/.orison/model/index.yaml`
  - `~/.orison/model/profiles/*.yaml`
- 每个 profile 表示一组：
  - `provider`
  - `baseUrl`
  - `apiKey`
- 每个 profile 下的 `models[]` 表示具体模型条目：
  - `id`
  - `alias`
  - `apiFormat`
  - `capabilities`
- 槽位分配使用 `{ profileId, modelId }`
- `apps/desktop/shell/main/ipc/modelProviderIpc.ts`
  - 负责 `model:list-provider-models`
  - 只负责列模型，不负责生成
- `apps/desktop/shell/main/ipc/modelGatewayIpc.ts`
  - 负责 `model:generate-text`
  - 负责 `model:generate-image`
  - 负责 `model:generate-video`
  - 是唯一会解密模型 `apiKey` 并调用 provider 的主进程入口
- 渲染层永远拿不到真实 `apiKey`
- server 和 agent 也不再持有 provider `apiKey`

## Story Sync

- 共享 story-sync 逻辑放在 `packages/story-sync/`
- 共享内容包括：
  - prompt 构建
  - 响应解析
  - patch 安全校验
- desktop main 负责真正执行 story-sync LLM 调用
- 渲染层通过 `storySync:run` IPC 触发
- Agent 只负责：
  - 校验预计算补丁
  - 在补丁不可用时走规则回退
- 如果任何代码路径让 agent 重新直接请求第三方模型，应视为回归

## Desktop Local BFF

- `apps/desktop/local-bff` 是桌面端本地项目数据读写层
- 它负责：
  - `project.yaml`
  - 章节 markdown
  - `memory/story-memory.yaml`
  - 字段同步桥接后的本地写入
- 渲染层不能直接 import local-bff
- 渲染层写入必须走：
  - preload
  - shell IPC
  - local-bff
- `local-bff` 应保持 Electron 无关、路径驱动、便于测试

## Auto Mode 持久化

- Auto Mode 状态由 agent 侧拥有
- 主要模块：
  - `novelAutoModeRunner.ts`
  - `autoModeService.ts`
  - `autoModeStore.ts`
- 持久化位置：
  - `<projectPath>/runs/auto-mode/<autoModeId>.yaml`
- `POST /v1/orchestration/auto-mode/restore`
  - 是跨进程恢复会话的唯一公开入口

## 服务端

- 服务端路由保持薄层：
  - 校验输入
  - 调用 service
  - 翻译错误为 HTTP 响应
- 当前服务端只拥有这些责任：
  - `auth`
  - `project`
  - `task`
  - `orchestration proxy`
- 服务端 generation 模块已删除
- 服务端不再直接请求任何第三方模型 provider
- `/v1/orchestration/*` 全部作为 agent 代理转发
- 服务端是唯一对公网暴露的进程
- agent 只通过服务端代理间接访问

## 模型协议层

- 所有模型协议适配器放在 `packages/model-protocols/`
- 该包是纯 Node 包：
  - 不依赖 Fastify
  - 不依赖 Electron
  - 不依赖 dotenv
  - 不做文件系统副作用
- `listModels(provider, ...)`
  - 统一走 OpenAI 兼容层（`GET {baseUrl}/v1/models`）
  - 覆盖直连 OpenAI、NewAPI/OneAPI 中继等所有 provider
- `generateText / generateImage / generateVideo`
  - 按 `apiFormat` 选择生成协议
- 当前支持的 `apiFormat`：
  - `openai-chat-completions`
  - `openai-responses`
  - `claude-messages`
  - `gemini-generate-content`
  - `openai-images`（含 `/images/edits` multipart 分支，当 `request.image` 存在时自动切换）
  - `gemini-images`（Imagen `:predict` 端点）
  - `gemini-image-edit`（Gemini Flash/Pro Image 系列，走 `:generateContent` + `inline_data`）
  - `sora-videos`
- `providerOptions` 采用命名空间结构 `{ [apiFormat]: { ... } }`，每个 adapter 只读自己的命名空间
- text adapter 响应统一映射 `id`、`created`、`usage`（`promptTokens`/`completionTokens`/`totalTokens`）、`finishReason`（`stop`/`length`/`content_filter`/`tool_use`/`other`）
- image adapter 支持 `image`、`mask`、`referenceImages` 字段用于图像编辑
- 渲染层支持上传参考图进入编辑模式，自动切换到 `/images/edits` 端点并强制 n=1
- server 不允许 import 这个包
- 桌面主进程才是它的调用方

## 鉴权规则

- 当前公开 auth 路由：
  - `GET /v1/auth/public-key`（返回 RSA 公钥）
  - `POST /v1/auth/login`
  - `POST /v1/auth/register`
- 密码传输加密：
  - 客户端使用 RSA-OAEP（SHA-256）加密密码后传输
  - 服务端私钥解密后再做 bcrypt 校验
  - 密钥对存放于 `apps/server/keys/`（private.pem + public.pem，已 gitignore）
- `GET /v1/auth/me` 是受保护接口
- 桌面端启动时使用 `/v1/auth/me` 做 bootstrap
- `authSlice` 负责区分：
  - `checking`
  - `authenticated`
  - `anonymous`
  - `error`

## 文档同步规则

- 只要以下内容发生变化，就必须同步更新文档：
  - 架构边界
  - 存储位置
  - IPC surface
  - 服务端 API
  - 模型配置结构
  - 启动鉴权行为
- 根目录文档与 `docs/` 中对应参考文档都要一起更新

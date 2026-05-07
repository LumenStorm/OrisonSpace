# Orison Space UI 页面与元素设计文档

## 1. 页面总览

当前桌面端有三个顶层页面：

| 页面 | 触发条件 | 说明 |
|---|---|---|
| 登录 / 注册页 `AuthPage` | `authStatus !== 'authenticated'` | 启动无会话、会话过期、bootstrap 失败时进入 |
| 项目页 `ProjectsPage` | 已登录但没有打开项目 | 展示最近项目、新建项目、打开项目 |
| 工作区 `WorkspacePage` | 已登录且已打开项目 | 进入创作主界面 |

重要更新：

- 启动时不再只看本地 token 是否存在
- 会先做 session bootstrap
- token 过期时不会先落到项目页

## 2. 登录 / 注册页

### 布局

- 中央卡片式布局
- 顶部保留品牌名与副标题
- 顶层仍显示极简模式 TopBar

### 交互元素

| 元素 | 说明 |
|---|---|
| 登录 / 注册切换 Tab | 切换模式时清理当前错误 |
| 邮箱输入框 | `autocomplete="email"` |
| 密码输入框 | 支持显示 / 隐藏切换 |
| 显示名输入框 | 仅注册模式展示 |
| 错误提示 | `role="alert"` |
| 提交按钮 | 登录时为 `Sign In`，注册时为 `Create Account` |

### 会话启动行为

- 若本地存在 token，`authSlice.bootstrapAuth()` 会先调用 `/v1/auth/me`
- 成功后进入项目页或工作区
- 401 则清空本地会话
- 非 401 失败也停留在登录页，并显示错误信息

## 3. 项目页

### 页面职责

- 管理最近项目
- 新建项目
- 打开本地项目目录
- 显示当前用户信息

### 关键元素

| 元素 | 说明 |
|---|---|
| Header 品牌名 | `Orison Space` |
| 用户信息区 | 显示 `displayName` 与 `email` |
| Logout 按钮 | 主动退出当前会话 |
| 新建项目卡片 | 打开 `NewProjectDialog` |
| 打开项目卡片 | 调用系统目录选择器 |
| 最近项目卡片 | 打开已有项目 |
| 刷新按钮 | 检测最近项目目录是否存在，并同步 `project.json` 中的名称、类型、封面和 projectId |
| 空状态 | 没有最近项目时显示引导区 |

项目页进入时会自动刷新一次最近项目列表。若项目目录已不存在，直接从最近项目列表移除；若本地 `project.json` 已修改，则同步更新卡片信息。

## 4. 工作区总布局

工作区由以下区域构成：

- TopBar
- 左侧 Icon Rail
- 左侧 Project Tree
- 中间 EditorArea
- 底部 BottomPanel

### TopBar

职责：

- 自定义标题栏
- 主导航菜单
- 窗口控制

菜单组：

- 文件
- 编辑
- 视图
- 帮助

### 左侧导航

图标导航栏根据项目类型展示模块入口：

#### novel 项目

- outline
- novel
- storyboard
- image_gen
- video

#### script 项目

- outline
- script
- storyboard
- image_gen
- video

底部固定入口：

- settings
- account

## 5. 模型设置页

### 当前数据概念

这页底层仍然是 profile 概念：

- 一个 profile = 一组 `provider + baseUrl + apiKey`
- 一个 profile 下包含多个模型条目 `models[]`

这不是 UI 上的 bug，UI bug 在于页面交互状态曾经不清晰。

### 当前交互状态

现在模型设置页已经明确分为四种 UI 状态：

| 状态 | 说明 |
|---|---|
| `idle` + 无 profile | 显示“还没有模型”的空状态 |
| `creating` | 显示新建编辑器 |
| `editing` | 显示已选中 profile 的编辑器 |
| `idle` + 有 profile | 显示“请选择一个配置”的占位态 |

### 页面结构

- 左侧：Profile 列表
- 右侧：Profile 编辑器或空状态
- 底部：槽位分配（novel / image / video）

### 编辑器字段

#### 身份区

- `profileName`
- `provider`

#### 凭据区

- `apiKey`
- `baseUrl`
- 刷新 provider 模型列表按钮

#### 模型区

- 每个 model entry 包含：
  - `id`
  - `alias`
  - `apiFormat`
  - `capabilities`

### 重要交互

- 空状态点击“添加模型”会直接进入编辑器
- 已有 profile 但未选中时，不再默认渲染隐式新建编辑器
- 刷新模型列表后，可按 provider 返回结果填充模型条目

## 6. 图片生成模块

### 关键点

- 图片生成不再通过服务端 generation route
- 当前走 desktop main IPC：
  - `model:generate-image`
- 结果先保存到项目 `temp/images/generation/`
- 页面加载时读取 `temp/images/generation/` 的文件名索引，当前页图片按需分页懒加载二进制
- 支持本地编辑：可选颜色画笔、画圈、遮罩、裁切
- 编辑结果直接保存到 `temp/images/generation/`
- 用户确认后移动到 `assets/images/`

### 主区 UI

- 顶部 profile chip：只显示 `provider · modelAlias`，无参数入口；所有参数（尺寸 / 数量 / 质量 / 输出格式等）集中在 BottomPanel 的 properties tab，主区不再出现任何参数线索
- Prompt 输入：大尺寸文本区 + 右下角 Generate 主按钮；生成中图标旋转；错误以可关闭的 banner 呈现
- 画廊：1:1 正方形卡片网格，`object-fit: contain` 保证非方图不被裁切，棋盘纹底色；卡片支持分页，默认每页 12 张
- 卡片交互：
  - 顶部浮条（hover/focus）：预览、编辑、加入素材库、删除
  - 底部浮条（hover/focus）：单行 prompt + `…` 省略，右侧复制 SVG 图标
  - 状态标识：`generated` / `edited` 角标；已入库卡片右上角换成 check 徽标
  - 已入库图片的"删除"按钮禁用（需先从素材库移除），未入库可直接删除 temp 目录文件
- 预览弹窗：居中大图、左右键盘切换（也有左右箭头按钮）、Esc 关闭、底部操作栏（编辑 / 加入素材库）+ prompt 单行显示 + 复制图标

### 编辑弹窗

- 工具栏分三组，竖分隔可视化：Tool（Brush / Circle / Mask / Crop）· Style（color + size 或 crop 专用按钮）· History（Reset to original / Undo / Redo）
- 右端固定 Cancel / Save 主操作
- Mask 工具下遮罩以半透明 `mix-blend-mode: screen` 叠加显示，其他工具下隐藏但保留数据
- Esc 关闭弹窗
- 小屏下工具组自动换行

## 7. Story Sync 相关 UI 行为

- 桌面端发起章节编排前，可先本地执行 `storySync:run`
- 返回的 patch 会嵌入 orchestration run body
- agent 若发现 patch 无效，会回退到规则路径

## 8. 底部面板

BottomPanel 当前包含：

- properties
- tasks
- output

其中：

- properties：根据当前模块显示参数或设置字段
- tasks：任务流与状态
- output：真实输出控制台，不再是纯占位

## 9. 当前 UI 设计与代码的一致性说明

以下是已经同步到代码的现状：

- 启动时鉴权先校验会话，再决定进入哪个页面
- 模型设置页交互状态已收口，不再混乱地依赖隐式条件
- 模型生成走 desktop main，不走 server generation route
- story-sync 已变为桌面本地执行 + agent 二次校验

## 10. 样式组织约定

- 渲染层全局样式位于 `apps/desktop/ui/src/shared/styles/`
- 采用文件夹分层：
  - 根：`tokens.css`、`global.css`（唯一入口）、`inspector.css`、`creative.css`
  - `base/`：`components.css`、`welcome.css`
  - `layout/`：`workspace.css`、`topbar.css`、`sidebar.css`、`pages.css`
  - `editor/`：`tiptap.css`、`script.css`、`video.css`、`image-gen.css`、`image-dialog.css`、`novel.css`、`file.css`
- `global.css` 通过 `@import` 串联所有文件，顺序与原单文件时期一致，级联敏感规则（例如 `.image-gen-inspector-*` 排在 `.image-gen-*` 之后、`components.css` 作为末尾层）必须保留
- 渲染层只 import 一次 `global.css`，不单独引入子文件

## 11. 后续更新要求

若以下任一行为变化，需要同步更新本文档：

- 登录 / 启动鉴权流程
- 页面切换条件
- 模型设置页交互状态
- 图片生成入口和保存路径
- story-sync 在 UI 中的触发方式

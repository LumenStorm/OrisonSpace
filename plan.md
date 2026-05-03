# UI 完善实施记录

## 已完成

### 第一批：Bug 修复 + 核心交互
- [x] TiptapEditor isActive bug 修复（显式 activeName 映射）
- [x] FileEditor Ctrl+S 保存快捷键
- [x] TopBar 菜单键盘导航（Arrow/Enter/Escape + 菜单间切换）
- [x] 全局快捷键 useGlobalShortcuts（Ctrl+S/Z/Shift+Z/N/O）
- [x] AboutDialog + Help → About 菜单接入

### 第二批：页面布局打磨
- [x] AuthPage：密码可见切换、autoComplete、tab 清错误、焦点管理
- [x] ProjectsPage：header + 空状态 + 卡片 hover 动画 + section title
- [x] WorkspaceLayout：底部面板 CSS transition + 720px 响应式断点修正

### 第三批：侧边栏 & 项目树
- [x] 新增 6 个 IPC 通道（read-directory/delete-entry/rename-entry/create-entry/read-file/write-file）
- [x] ProjectTree 读取真实目录（懒加载 depth=1）+ 右键菜单调用真实 IPC
- [x] 文件树展开/折叠 CSS 过渡动画
- [x] SideNav aria-label 修正

### 安全加固
- [x] pathGuard.ts 路径校验（所有 IPC 文件操作）
- [x] windowIpc 删除自动创建文件逻辑
- [x] API Key safeStorage 加密
- [x] CSP 主进程动态注入（仅 prod）
- [x] ErrorBoundary 包裹 App
- [x] authSlice catch 类型安全
- [x] 默认模型名置空，改为刷新供应商模型列表后选择兼容模型

### 性能优化
- [x] dirtyPaths / ctxItems useMemo 缓存
- [x] readDirectoryRecursive MAX_ENTRIES_PER_DIR=500 + maxDepth 钳位

## 待完成

### 第四批：底部面板 & Inspector
- [ ] Inspector 字段改为受控组件
- [ ] TaskFeed / OrchestrationPanel 样式补全 + i18n
- [ ] Output tab 日志面板

### 第五批：创作字段编辑器
- [ ] 各 view 表单交互完善
- [ ] RelationshipGraphEditor SVG 响应式
- [ ] CurvesView 交互增强
---

## 2026-05-03 Session Sync

- Synced the desktop UI split rules into `docs/architecture/module-boundaries.md`.
- Recorded the current project storage rule: new desktop projects live under `~/Documents/OrisonSpace`.
- Recorded config storage rules: model config lives at `~/.orison/model/config.yaml`; user preferences live at `~/.orison/user/preferences.yaml`.
- Recorded server generation API shape: provider-routed text and image generation under `/v1/generation/:provider/*`.
- No numeric file-size thresholds are defined yet; the rulebook focuses on ownership, coupling, and split boundaries.

## 2026-05-03 Image Generation Sync

- 图片生成编辑器已接入 `POST /v1/generation/:provider/image`，使用设置页中当前 `image` 模型槽的 provider / apiKey / baseUrl / model。
- 服务端图片响应统一归一化为 `b64Json`、`mimeType`、`dataUrl`；OpenAI-compatible 请求显式使用 `response_format: "b64_json"`，URL-only 结果会下载后转 base64。
- 桌面 IPC 新增 `project:save-base64-image`、`project:move-file`、`project:delete-file`，生成图先落到项目 `temp/images/`，保存后移动到 `assets/images/`。
- 图片生成结果可预览、保存文件，并写入 creative `asset_cards`，`sourceRefs` 指向项目内图片相对路径。

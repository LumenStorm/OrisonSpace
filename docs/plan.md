# 开发日志

## 重构：代码解耦与模块化

### Store 拆分
- `appStore.ts` 从单文件拆为 8 个 slice：authSlice、projectSlice、settingsSlice、panelsSlice、tasksSlice、editorSlice、creativeFieldsSlice、fileTabsSlice
- 新增 `types.ts` 统一类型定义，`storage.ts` 封装 localStorage 访问

### 组件抽取
- `NewProjectDialog` — TopBar 和 ProjectsPage 共享的新建项目对话框
- `WindowControls` — 窗口控制按钮（最小化/最大化/关闭）
- `ResizeHandle` — 面板拖拽调整宽度

### CSS 模块化
- `global.css`（742 行）拆为：welcome.css、topbar.css、workspace.css、sidebar.css、inspector.css
- global.css 仅保留 imports + reset

### 数据提取
- InspectorPanel 配置数据提取到 `shared/data/inspectorFields.ts`
- 魔法数字提取到 `shared/constants.ts`

---

## 安全修复

### JWT 签名
- 用 `jose` 库替换 base64 伪 JWT，HS256 签名 + 2 小时过期
- 生产环境强制 JWT_SECRET 至少 32 字符

### CORS
- 从 `origin: true` 改为白名单（localhost:5173、localhost:4000、app://.)

### 轮询泄漏
- tasksSlice 添加 AbortController，新请求自动取消旧轮询

---

## 性能优化

- SideNav / WorkspaceLayout 多个独立 selector 合并为 `useShallow` 单选择器
- SideNav toggle 函数用 `useCallback` 包裹
- ResizeHandle 用 `useRef` 保存最新回调，避免闭包捕获旧值

---

## Bug 修复

### 项目选择页无返回入口
- TopBar 新增 Home 按钮，点击 `closeProject()` 返回项目选择页

### 面板拉伸被锁回初始状态
- ResizeHandle 改用 ref 调用最新 onResize，不再闭包旧值
- WorkspaceLayout resize handler 改用 `useAppStore.getState()` 读取实时宽度

---

## 安全加固（2026-04-30）

### IPC 路径校验
- 新增 `shell/main/ipc/pathGuard.ts`，提供 `isSafePath`、`assertSafePath`、`assertWithinProject` 三个工具函数
- `projectIpc.ts` 所有 12 个文件操作 handler 加入路径校验，拒绝用户主目录以外的路径
- `windowIpc.ts` 的 `shell:show-item-in-folder` / `shell:open-path` 加入路径校验，删除自动创建文件/目录的逻辑

### API Key 加密
- `configIpc.ts` 使用 Electron `safeStorage` API 加密 API Key 后写入 `~/.orison/config.json`，读取时解密
- 不支持 `safeStorage` 的环境自动回退到明文（兼容 CI）

### CSP 动态注入
- 移除 `index.html` 中硬编码的 `<meta>` CSP 标签
- 主进程通过 `session.webRequest.onHeadersReceived` 动态注入 CSP
- 仅生产构建注入（dev 模式下 Vite dev server origin 与 `'self'` 不匹配，跳过注入）

### 默认模型名修正
- `configIpc.ts` 默认模型从 `gpt-5.4` 改为 `gpt-4o`

---

## UI 完善（2026-04-30）

### 第一批：Bug 修复 + 核心交互
- TiptapEditor toolbar `isActive` 检测改为显式 `activeName` 映射，修复 codeBlock / bulletList / orderedList 高亮失效
- FileEditor 添加 Ctrl+S / Cmd+S 快捷键调用 `saveFile`
- TopBar MenuDropdown 支持 Arrow/Enter/Escape 键盘导航 + ARIA 角色 + 菜单间 Left/Right 切换
- 新增 `useGlobalShortcuts` hook，统一注册 Ctrl+S/Z/Shift+Z/N/O
- 新增 `AboutDialog` 组件，Help → About 菜单项接入

### 第二批：页面布局打磨
- AuthPage：密码可见切换、autoComplete 属性、tab 切换清错误、提交失败焦点管理
- ProjectsPage：新增 header（品牌名 + 用户信息 + 登出）、空状态引导、卡片 hover translateY(-2px) 动画、section title、max-width 960px 居中
- WorkspaceLayout：底部面板改为 CSS transition 折叠/展开（不再条件移除 DOM）、720px 断点强制 grid columns 回退

### 第三批：侧边栏 & 项目树
- 新增 6 个 IPC 通道：`project:read-directory`、`delete-entry`、`rename-entry`、`create-entry`、`read-file`、`write-file`
- ProjectTree 改为通过 IPC 读取真实目录（懒加载 depth=1，展开时按需加载子级）
- 右键菜单的删除/重命名/新建操作调用真实 IPC
- 文件树展开/折叠改用 `grid-template-rows` CSS 过渡动画
- SideNav `aria-label` 从 "Project Tree" 修正为 "Main Navigation"
- `dirtyPaths` 和 `ctxItems` 改用 `useMemo` 缓存

### 其他
- 新增 `ErrorBoundary` 组件包裹 `<App />`，防止渲染异常白屏
- `authSlice` 的 `catch (e: any)` 改为 `catch (e: unknown)` + 类型安全处理
- ProjectTree 的 `FileEntry` 类型改为复用 `@orison/shared-contracts` 的 `FileTreeEntry`
- preload 安全白名单测试更新为 22 个方法

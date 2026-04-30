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

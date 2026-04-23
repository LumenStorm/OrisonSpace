# 主题 + 多语言抽离方案

## 目标
1. 将 tokens.css 中的颜色变量拆为 light/dark 两套主题，用 YAML 存储，构建时生成 CSS
2. 将所有 UI 硬编码文本抽离为 YAML 语言包，支持 zh-CN / en-US，根据系统语言自动选择
3. 两者均支持扩展：新增 YAML 文件即自动注册，无需改代码

## 实施状态：✅ 已完成

## 文件结构

```
apps/desktop/ui/src/shared/
├── themes/
│   ├── light.yaml          # 亮色主题 token 值
│   ├── dark.yaml           # 暗色主题 token 值
│   └── buildThemes.ts      # YAML → CSS 变量生成脚本
├── i18n/
│   ├── zh-CN.yaml          # 中文语言包
│   ├── en-US.yaml          # 英文语言包
│   └── useI18n.ts          # React hook：import.meta.glob 自动扫描 + t() 函数
├── store/
│   └── appStore.ts         # theme / locale 状态 + localStorage 持久化
└── styles/
    └── tokens.css          # 由 buildThemes 生成，含 :root / [data-theme] 选择器
```

## 一、主题系统 ✅

### 1. light.yaml / dark.yaml
YAML 定义所有 design token，支持 `_computed` 字段（rgba 等复合值）。

### 2. buildThemes.ts
- 自动扫描 `themes/*.yaml`
- 生成 `tokens.css`：`:root` + `[data-theme="light"]` 使用 light 值，`[data-theme="dark"]` 使用 dark 值
- `[data-theme="system"]` 通过 `prefers-color-scheme` 媒体查询自动切换

### 3. appStore 主题状态
```ts
theme: 'system' | 'light' | 'dark' | string  // 支持自定义主题名
setTheme(theme)  // 持久化到 localStorage，设置 document.documentElement.dataset.theme
```

### 4. CSS 硬编码颜色清理 ✅
pages.css / global.css / editor.css 中所有硬编码颜色已替换为 `var(--token)` 引用。

## 二、多语言系统 ✅

### 1. zh-CN.yaml / en-US.yaml
按模块分 namespace（auth / projects / nav / outline / script / storyboard / video / inspector / tasks / editor / welcome / settings）。

### 2. useI18n hook
- `import.meta.glob('./*.yaml')` 运行时自动扫描所有语言包
- `t(key, vars?)` — 支持插值 `{n}`、`{summary}` 等
- `tArray(key)` — 获取数组值（如 inspector 选项列表）
- 缺失 key 自动回退到 en-US

### 3. 系统语言检测
- 优先使用 Electron preload 暴露的 `getLocale()`
- 回退 `navigator.language`
- `zh` 开头 → zh-CN，其余匹配已有 locale 或回退 en-US

### 4. appStore 语言状态
```ts
locale: 'system' | 'zh-CN' | 'en-US' | string
resolvedLocale: string  // 实际生效的语言
setLocale(locale)  // 持久化到 localStorage
```

### 5. 组件 i18n 覆盖 ✅
所有组件已替换硬编码文本为 `t()` 调用：
- AuthPage、ProjectsPage、TopBar、SideNav
- OutlineEditor、ScriptEditor、VideoEditor
- InspectorPanel、TaskFeedPanel

## 三、自定义标题栏 ✅

隐藏原生标题栏，TopBar 组件替代实现。

### 实现方式
- **Windows/Linux**：`BrowserWindow({ frame: false })`，TopBar 右侧显示最小化/最大化/关闭按钮
- **macOS**：`titleBarStyle: 'hidden'`，保留原生红绿灯，TopBar 左侧 70px 占位避让

### IPC 通道
| Channel | Direction | Description |
|---|---|---|
| `window:minimize` | renderer → main | 最小化窗口 |
| `window:maximize` | renderer → main | 最大化/还原窗口 |
| `window:close` | renderer → main | 关闭窗口 |
| `window:is-maximized` | renderer → main | 查询是否最大化 |

### 文件改动
- `shell/main/ipc/windowIpc.ts` — 窗口控制 IPC 处理
- `shell/main/index.ts` — 无框窗口配置
- `shell/preload/index.ts` — 暴露 minimize/maximize/close/isMaximized/platform
- `ui/src/features/top-bar/TopBar.tsx` — 窗口控制按钮 + `-webkit-app-region: drag`
- `ui/src/shared/styles/global.css` — 拖拽区域 + 窗口控制按钮样式

## 四、扩展机制

### 语言扩展
新增语言只需在 `i18n/` 目录下新建 `{locale}.yaml`，运行时自动扫描注册。

### 主题扩展
新增主题只需在 `themes/` 目录下新建 `{theme-name}.yaml`，运行 `buildThemes.ts` 自动生成对应 CSS。

### 约定
- 文件名即标识符：`ja-JP.yaml` → locale `ja-JP`，`monokai.yaml` → theme `monokai`
- 所有 YAML 必须包含与基准文件相同的 key 集合，缺失 key 回退到 en-US（语言）或 light（主题）

## 五、依赖
- `js-yaml`：运行时解析 YAML
- 无需 react-i18next 等重框架

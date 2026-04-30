# Desktop IPC Reference

## Overview

The desktop shell exposes a minimal IPC surface to the renderer process via `contextBridge`. The renderer accesses it through `window.orisonDesktop`.

The canonical type definition lives in `packages/shared-contracts/src/ipc.ts` (`OrisonDesktopApi`). Both the preload script and the renderer type declaration (`preload.d.ts`) reference this single source of truth.

## Whitelisted Channels

### Project Channels

| Channel | Direction | Type | Description |
|---|---|---|---|
| `project:pick-directory` | renderer → main | invoke | Opens native directory picker, returns selected path or `null` |
| `project:create-directory` | renderer → main | invoke | Creates a new project directory under `parentDir` with given `name`, returns the created path |
| `project:pick-cover-image` | renderer → main | invoke | Opens native image picker for cover image, returns selected path or `null` |
| `project:copy-cover-image` | renderer → main | invoke | Copies cover image `src` into `projectDir`, returns destination path |
| `project:save-meta` | renderer → main | invoke | Saves project metadata (JSON object) to `projectDir` |
| `project:load-meta` | renderer → main | invoke | Loads project metadata from `projectDir`, returns object or `null` |

### Window Channels

| Channel | Direction | Type | Description |
|---|---|---|---|
| `window:minimize` | renderer → main | send | Minimize the window |
| `window:maximize` | renderer → main | send | Toggle maximize / restore |
| `window:close` | renderer → main | send | Close the window |
| `window:is-maximized` | renderer → main | invoke | Returns `boolean` — whether the window is maximized |

### Shell Channels

| Channel | Direction | Type | Description |
|---|---|---|---|
| `shell:show-item-in-folder` | renderer → main | send | Reveals a file in the system file manager; creates parent directory if needed |
| `shell:open-path` | renderer → main | send | Opens a path with the system default handler |

### Config Channels

| Channel | Direction | Type | Description |
|---|---|---|---|
| `config:load-model` | renderer → main | invoke | Loads model configuration (apiKey, baseUrl, model) from disk |
| `config:save-model` | renderer → main | invoke | Saves model configuration to disk |

## Security Constraints

- `contextIsolation`: enabled
- `nodeIntegration`: disabled
- `sandbox`: enabled
- Only channels listed above are permitted
- The preload script exposes a fixed set of methods via `contextBridge`
- `shell:show-item-in-folder` and `shell:open-path` validate that paths are absolute and safe (descendant of project directory) before executing

## Exposed API

```typescript
window.orisonDesktop: {
  // 项目
  pickProjectDirectory: () => Promise<string | null>
  createProjectDirectory: (parentDir: string, name: string) => Promise<string>
  pickCoverImage: () => Promise<string | null>
  copyCoverImage: (src: string, projectDir: string) => Promise<string>
  saveProjectMeta: (projectDir: string, meta: Record<string, unknown>) => Promise<void>
  loadProjectMeta: (projectDir: string) => Promise<Record<string, unknown> | null>

  // 语言
  getLocale: () => string

  // 窗口控制（自定义标题栏）
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>

  // 平台标识
  platform: string   // 'darwin' | 'win32' | 'linux'

  // 字段同步（preload 已暴露，主进程 handler 尚未实现）
  syncField: (field: string, data: unknown) => Promise<void>

  // 模型配置
  loadModelConfig: () => Promise<ModelConfig>
  saveModelConfig: (config: ModelConfig) => Promise<void>

  // 系统 shell
  showItemInFolder: (fullPath: string) => void
  openPath: (fullPath: string) => void
}
```

### ModelConfig

```typescript
type ModelConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};
```

## Window Control (Custom Title Bar)

The app uses a frameless window with a custom title bar implemented in the renderer:

- **Windows/Linux**: `BrowserWindow({ frame: false })` — native title bar is hidden, TopBar component renders minimize/maximize/close buttons
- **macOS**: `titleBarStyle: 'hidden'` — native traffic lights are preserved, TopBar adds left padding (70px) to avoid overlap

IPC handlers are registered in `shell/main/ipc/windowIpc.ts`.

## IPC Handler Files

| File | Channels |
|------|----------|
| `shell/main/ipc/windowIpc.ts` | `window:*`, `shell:*` |
| `shell/main/ipc/projectIpc.ts` | `project:*` |
| `shell/main/ipc/configIpc.ts` | `config:*` |

## Known Issues

- `field:sync` channel is exposed in the preload script but has no corresponding `ipcMain.handle()` in the main process. Calling it will result in a runtime error.

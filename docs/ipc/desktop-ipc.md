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
| `project:read-directory` | renderer → main | invoke | Recursively reads a directory, returns `FileTreeEntry[]`. Accepts optional `maxDepth` (default 5, clamped 1–8). Skips hidden files and `node_modules`. |
| `project:delete-entry` | renderer → main | invoke | Deletes a file or directory (recursive). Returns `boolean`. |
| `project:rename-entry` | renderer → main | invoke | Renames a file or directory. Returns `boolean`. |
| `project:create-entry` | renderer → main | invoke | Creates a file (empty) or directory. Returns `boolean`. |
| `project:read-file` | renderer → main | invoke | Reads file content as UTF-8 string. Returns `string | null`. |
| `project:write-file` | renderer → main | invoke | Writes UTF-8 string to file. Creates parent directories if needed. Returns `boolean`. |

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
| `shell:show-item-in-folder` | renderer → main | send | Reveals a file in the system file manager. No-op if path doesn't exist. |
| `shell:open-path` | renderer → main | send | Opens a path with the system default handler. No-op if path doesn't exist. |

### Config Channels

| Channel | Direction | Type | Description |
|---|---|---|---|
| `config:load-model` | renderer → main | invoke | Loads model configuration (apiKey, baseUrl, model) from disk. API key is decrypted via `safeStorage`. |
| `config:save-model` | renderer → main | invoke | Saves model configuration to disk. API key is encrypted via `safeStorage`. |

## Security

### Sandbox & Isolation

- `contextIsolation`: enabled
- `nodeIntegration`: disabled
- `sandbox`: enabled
- The preload script exposes a fixed set of 22 methods via `contextBridge`

### Path Validation

All file operation IPC handlers (`project:*` except dialog-based pickers, plus `shell:*`) validate paths using `pathGuard.ts`:

- `assertSafePath(target)` — rejects paths outside the user's home directory
- `assertWithinProject(projectDir, target)` — rejects paths that escape a specific project directory
- `shell:show-item-in-folder` and `shell:open-path` silently ignore invalid or non-existent paths (no file/directory creation)

### API Key Encryption

Model configuration is stored at `~/.orison/config.json`. The `apiKey` field is encrypted using Electron's `safeStorage` API (OS keychain) before writing to disk, and decrypted on read.

### Content Security Policy

CSP is injected dynamically by the main process via `session.webRequest.onHeadersReceived` (production builds only). Dev mode skips CSP injection because the Vite dev server origin doesn't match `'self'`.

## Exposed API

```typescript
window.orisonDesktop: {
  // 项目（对话框）
  pickProjectDirectory: () => Promise<string | null>
  createProjectDirectory: (parentDir: string, name: string) => Promise<string>
  pickCoverImage: () => Promise<string | null>
  copyCoverImage: (src: string, projectDir: string) => Promise<string>
  saveProjectMeta: (projectDir: string, meta: Record<string, unknown>) => Promise<void>
  loadProjectMeta: (projectDir: string) => Promise<Record<string, unknown> | null>

  // 文件树操作
  readDirectory: (projectDir: string, maxDepth?: number) => Promise<FileTreeEntry[]>
  deleteEntry: (fullPath: string) => Promise<boolean>
  renameEntry: (oldPath: string, newPath: string) => Promise<boolean>
  createEntry: (fullPath: string, isDir: boolean) => Promise<boolean>
  readFile: (fullPath: string) => Promise<string | null>
  writeFile: (fullPath: string, content: string) => Promise<boolean>

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

### FileTreeEntry

```typescript
type FileTreeEntry = {
  name: string;
  path: string;     // relative to project root, e.g. "/chapters/ch-001.md"
  isDir: boolean;
  children?: FileTreeEntry[];
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
| `shell/main/ipc/pathGuard.ts` | Path validation utilities (not an IPC handler) |

## Known Issues

- `field:sync` channel is exposed in the preload script but has no corresponding `ipcMain.handle()` in the main process. Calling it will result in a runtime error.

## 2026-05-03 Updates

### Config Channels

| Channel | Direction | Type | Description |
|---|---|---|---|
| `config:load-model` | renderer to main | invoke | Loads model configuration from `~/.orison/model/config.json`; API key is decrypted via `safeStorage`. |
| `config:save-model` | renderer to main | invoke | Saves model configuration to `~/.orison/model/config.json`; API key is encrypted via `safeStorage`. |
| `config:load-user-preferences` | renderer to main | invoke | Loads user preferences from `~/.orison/user/preferences.json`. |
| `config:save-user-preferences` | renderer to main | invoke | Saves user preferences to `~/.orison/user/preferences.json`. |

The old model config path `~/.orison/config.json` is intentionally not read for compatibility.

### Path Scope

- New project creation defaults to `~/Documents/OrisonSpace`.
- File and shell path validation rejects paths outside `~/Documents/OrisonSpace`.

### UserPreferencesConfig

```typescript
type UserPreferencesConfig = {
  theme: string;
  locale: string;
  autoApplyPatches: boolean;
};
```

Preferences intentionally excluded from this global file:
- layout
- recent projects
- auth

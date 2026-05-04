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
| `project:save-base64-image` | renderer → main | invoke | Saves a base64 image into an allowed project image directory. Returns `{ relativePath, fullPath, fileName }`. |
| `project:move-file` | renderer → main | invoke | Moves a project-relative file to another project-relative path. Creates parent directories if needed. Returns destination path. |
| `project:delete-file` | renderer → main | invoke | Deletes a project-relative file. Returns `boolean`. |

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
| `config:load-user-preferences` | renderer → main | invoke | Loads user preferences from disk. |
| `config:save-user-preferences` | renderer → main | invoke | Saves user preferences to disk. |

Model provider list refresh also uses `model:list-provider-models` from renderer to main. The desktop main process performs the provider HTTP request so model list refresh is still a desktop feature while avoiding renderer CORS limits.

## Security

### Sandbox & Isolation

- `contextIsolation`: enabled
- `nodeIntegration`: disabled
- `sandbox`: enabled
- The preload script exposes a fixed allowlisted API surface via `contextBridge`.

### Path Validation

All file operation IPC handlers (`project:*` except dialog-based pickers, plus `shell:*`) validate paths using `pathGuard.ts`:

Current behavior:
- `allowPath(target)` registers a user-selected path as an allowed root for the current Electron main-process session.
- `project:pick-directory`, `project:pick-cover-image`, and `project:create-directory` register the selected or created path before returning it to the renderer.
- `assertSafePath(target)` rejects paths outside the default project root and current-session allowed roots.
- `assertWithinProject(projectDir, target)` rejects paths that escape a specific project directory.
- `shell:show-item-in-folder` and `shell:open-path` silently ignore invalid or non-existent paths (no file/directory creation).
- Generated image writes are additionally constrained to `temp/images` and `assets/images`.

### API Key Encryption

Model configuration is stored at `~/.orison/model/index.yaml` plus one YAML file per profile under `~/.orison/model/profiles/`. Legacy `~/.orison/model/config.yaml` is read for migration. The `apiKey` field is encrypted using Electron's `safeStorage` API (OS keychain) before writing profile files, and decrypted on read.

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
  saveBase64Image: (projectDir: string, input: SaveBase64ImageInput) => Promise<SavedImageFile>
  moveProjectFile: (projectDir: string, fromRelativePath: string, toRelativePath: string) => Promise<string>
  deleteProjectFile: (projectDir: string, relativePath: string) => Promise<boolean>

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
  syncField: (projectPath: string, field: string, data: unknown) => Promise<void>

  // 模型配置
  loadModelConfig: () => Promise<ModelConfig>
  saveModelConfig: (config: ModelConfig) => Promise<void>
  listProviderModels: (request: ProviderModelListRequest) => Promise<ProviderModel[]>
  loadUserPreferences: () => Promise<UserPreferencesConfig>
  saveUserPreferences: (config: UserPreferencesConfig) => Promise<void>

  // 系统 shell
  showItemInFolder: (fullPath: string) => void
  openPath: (fullPath: string) => void
}
```

### ModelConfig

```typescript
type ModelConfig = {
  profiles: Array<{
    id: string;
    name: string;
    provider: 'openai' | 'gcp' | 'anthropic';
    apiKey: string;
    baseUrl: string;
    model: string;
    capabilities: Array<'text' | 'image' | 'video'>;
  }>;
  selected: {
    novel: string | null;
    image: string | null;
    video: string | null;
  };
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

### Generated Image Files

```typescript
type SaveBase64ImageInput = {
  b64Json: string;
  mimeType: string;
  directory: 'temp/images' | 'assets/images';
  fileName?: string;
};

type SavedImageFile = {
  relativePath: string;
  fullPath: string;
  fileName: string;
};
```

Generated images are project-scoped. The image generation UI writes fresh results to `temp/images/`; when the user saves a result, the renderer moves it to `assets/images/` through `moveProjectFile`.

The renderer sends a canonical base64 payload (`b64Json`) to `saveBase64Image`. Provider responses may arrive as `b64Json`, `b64_json`, `base64`, or a `data:image/*;base64,...` payload, but those forms are normalized before this IPC call. The shell converts the base64 payload to bytes and writes the image file inside the project directory.

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
| `shell/main/ipc/fieldSyncIpc.ts` | `field:sync` |
| `shell/main/ipc/modelProviderIpc.ts` | `model:list-provider-models` |
| `shell/main/ipc/pathGuard.ts` | Path validation utilities (not an IPC handler) |

## Known Issues

- No known IPC surface mismatch at this time; preload and shared `OrisonDesktopApi` are the source of truth.

## 2026-05-03 Updates

### Config Channels

| Channel | Direction | Type | Description |
|---|---|---|---|
| `config:load-model` | renderer to main | invoke | Loads model profile configuration from `~/.orison/model/index.yaml` and `profiles/*.yaml`; API keys are decrypted via `safeStorage`. |
| `config:save-model` | renderer to main | invoke | Saves model profile configuration to `~/.orison/model/index.yaml` and `profiles/*.yaml`; API keys are encrypted via `safeStorage`. |
| `config:load-user-preferences` | renderer to main | invoke | Loads user preferences from `~/.orison/user/preferences.yaml`. |
| `config:save-user-preferences` | renderer to main | invoke | Saves user preferences to `~/.orison/user/preferences.yaml`. |

The old model config path `~/.orison/config.json` is intentionally not read for compatibility. Current model config is YAML-only.

The settings page manages a reusable model library and assigns profiles to `novel`, `image`, and `video`.

### Path Scope

- New project creation defaults to `~/Documents/OrisonSpace`.
- User-selected project directories and cover images are registered as allowed roots for the current Electron session.
- File and shell path validation rejects paths outside the default root and current-session allowed roots.
- Project-relative file operations still call `assertWithinProject`, so an allowed project cannot write to sibling directories.

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

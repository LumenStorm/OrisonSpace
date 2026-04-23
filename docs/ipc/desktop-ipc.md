# Desktop IPC Reference

## Overview

The desktop shell exposes a minimal IPC surface to the renderer process via `contextBridge`. The renderer accesses it through `window.orisonDesktop`.

## Whitelisted Channels

| Channel | Direction | Type | Description |
|---|---|---|---|
| `project:pick-directory` | renderer → main | invoke | Opens native directory picker, returns selected path or `null` |
| `window:minimize` | renderer → main | send | Minimize the window |
| `window:maximize` | renderer → main | send | Toggle maximize / restore |
| `window:close` | renderer → main | send | Close the window |
| `window:is-maximized` | renderer → main | invoke | Returns `boolean` — whether the window is maximized |

## Security Constraints

- `contextIsolation`: enabled
- `nodeIntegration`: disabled
- `sandbox`: enabled
- Only channels listed above are permitted
- The preload script exposes a fixed set of methods via `contextBridge`

## Exposed API

```typescript
window.orisonDesktop: {
  // 项目
  pickProjectDirectory: () => Promise<string | null>

  // 语言
  getLocale: () => string

  // 窗口控制（自定义标题栏）
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>

  // 平台标识
  platform: string   // 'darwin' | 'win32' | 'linux'
}
```

## Window Control (Custom Title Bar)

The app uses a frameless window with a custom title bar implemented in the renderer:

- **Windows/Linux**: `BrowserWindow({ frame: false })` — native title bar is hidden, TopBar component renders minimize/maximize/close buttons
- **macOS**: `titleBarStyle: 'hidden'` — native traffic lights are preserved, TopBar adds left padding (70px) to avoid overlap

IPC handlers are registered in `shell/main/ipc/windowIpc.ts`.

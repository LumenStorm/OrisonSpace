# Desktop IPC Reference

## Overview

The desktop shell exposes a minimal IPC surface to the renderer process via `contextBridge`. The renderer accesses it through `window.orisonDesktop`.

## Whitelisted Channels

| Channel | Direction | Description |
|---|---|---|
| `project:pick-directory` | renderer → main | Opens native directory picker, returns selected path or `null` |

## Security Constraints

- `contextIsolation`: enabled
- `nodeIntegration`: disabled
- `sandbox`: enabled
- Only channels listed in `desktopIpcSchema` are permitted
- The preload script exposes exactly one method: `pickProjectDirectory()`

## Exposed API

```typescript
window.orisonDesktop: {
  pickProjectDirectory: () => Promise<string | null>
}
```

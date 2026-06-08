# Windows Installer Packaging

Orison Space uses `electron-builder` to produce a Windows NSIS installer.

## Build Commands

From the repository root:

```powershell
pnpm install
pnpm package:desktop
```

The installer is written to the root-level `release/` directory:

```text
release/Orison Space-Setup-0.2.0.exe
```

For a portable unpacked build without generating an installer, run:

```powershell
pnpm package:desktop:portable
```

The portable build is written to:

```text
release/portable/win-unpacked/Orison Space.exe
```

Copy the whole `release/portable/win-unpacked/` directory together. `Orison Space.exe` is the launcher.

## Packaged Resources

The agent runs entirely in-process as TypeScript inside the Electron main process — there is no external runtime to bundle.

Native Node modules such as `better-sqlite3` are unpacked from asar so Electron can load their `.node` files.

## Application Icon

The source logo is `apps/desktop/client/shell/resources/icon.png` (1254×1254). The Windows installer and `.exe` require a multi-size `.ico` (electron-builder expects at least 256×256). Regenerate it from the PNG whenever the logo changes:

```powershell
pnpm --filter @orison/desktop-shell gen:icons
```

This runs `scripts/generate-icons.mjs` (via `png-to-ico`) and writes `resources/icon.ico` with embedded 16/32/48/256 sizes. Both `electron-builder.yml` and `electron-builder.portable.yml` point `win.icon` at `resources/icon.ico`, and the runtime `BrowserWindow` uses the same icon for the window/taskbar on Windows and Linux (macOS uses the bundled `.icns` from electron-builder).

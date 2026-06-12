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

## Auto-update (electron-updater)

The app self-updates via [`electron-updater`](https://www.electron.build/auto-update) using the GitHub Releases feed. Only the NSIS installer build self-updates — the portable build does not (it falls back to opening the releases page).

### How it works

- `electron-builder.yml` declares a `publish` block (`provider: github`, `owner: LumenStorm`, `repo: OrisonSpace`).
- On release, electron-builder uploads the installer plus `latest.yml` and a `.blockmap` to the GitHub Release. `latest.yml` is the feed the client polls.
- On startup (packaged builds only), the main process silently checks for updates when the `autoCheckUpdates` preference is on (default). A guided dialog appears only when a newer version is found.
- The dialog drives the full flow in-app: download (with progress) → "Restart & install". Major-version bumps (e.g. `1.x` → `2.x`) show a prominent banner.
- Users can also trigger a manual check from **Settings → General → Updates** or the top-bar menu.

### Versioning

The git tag is the single source of truth. CI strips the leading `v` and writes the version into the root and shell `package.json` before building:

```powershell
node scripts/set-version.mjs 0.3.0   # or: pnpm set-version 0.3.0
```

This keeps `app.getVersion()`, the installer filename, and `latest.yml` all in sync with the tag.

### Cutting a release

1. Commit your changes.
2. Tag and push: `git tag v0.3.0 && git push origin v0.3.0`.
3. The `Release` workflow (`.github/workflows/release.yml`) builds + publishes the NSIS installer (`--publish always`) and attaches a portable zip.

> The GitHub Release must **not** be a draft, or `latest.yml` is invisible to the updater and clients will never see the update.


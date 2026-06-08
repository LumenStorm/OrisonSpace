# Contributing to Orison Space

Thanks for your interest in contributing! Orison Space is an Alpha-stage,
local-first AI creative IDE built on Electron. This guide covers how to set up
the project, the workflow we follow, and what we expect in a pull request.

## Prerequisites

- **Node.js** ≥ 20 (the repo pins `24` in [`.nvmrc`](.nvmrc); run `nvm use`)
- **pnpm** ≥ 10 (the repo pins the exact version via `packageManager`)

## Setup

```bash
pnpm install
pnpm dev          # launch the Electron app in dev mode
```

Useful root scripts:

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Run the desktop app (electron-vite dev) |
| `pnpm build` | Build all workspace packages (Turbo) |
| `pnpm build:desktop` | Build only the desktop shell |
| `pnpm test` | Run the test suite (Vitest, via Turbo) |
| `pnpm typecheck` | Type-check all packages |
| `pnpm package:desktop` | Produce the Windows NSIS installer |

## Monorepo layout

This is a pnpm + Turbo monorepo. See the [README](README.md#仓库结构) for the full
tree. In short:

- `apps/desktop/client/shell` — Electron main process + preload + IPC
- `apps/desktop/client/ui` — React renderer
- `apps/desktop/agent` — `@orison/desktop-agent` orchestration library
- `packages/*` — shared contracts, model protocols, story-sync
- `docs/` — architecture & design docs

## Development workflow

1. Branch off `main` (or the active `dev` branch) with a descriptive name.
2. Make your change. Keep it focused — one concern per PR.
3. **Before committing**, run:
   ```bash
   pnpm typecheck
   pnpm test
   ```
4. If you change architecture boundaries, storage locations, the IPC surface,
   model config, or startup behavior, **update the matching docs** in `docs/`
   and the root README. See [`docs/`](docs/) for which file owns what.
5. Open a PR against `main` with a clear summary of what changed and how you
   tested it.

## Code style

- TypeScript throughout the app and packages; match the style of surrounding code.
- Formatting is enforced by [`.editorconfig`](.editorconfig) (2-space indent, LF, UTF-8).
- UI styling uses the design tokens in `tokens.css` — do not hardcode colors.
- Keep commits scoped and write conventional-style messages where practical
  (`feat:`, `fix:`, `chore:`, `docs:`).

## Reporting bugs

Open an issue with reproduction steps and your system info (OS, app version).
For security issues, **do not** open a public issue — see [SECURITY.md](SECURITY.md).

## Feature suggestions

Open an issue to discuss before building anything large. For small,
self-contained improvements, a direct PR is welcome.

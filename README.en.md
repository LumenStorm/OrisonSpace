# Orison Space

> AI-powered creative IDE for novels, screenplays, and storyboards — a full-pipeline workspace from inspiration to final draft.

[中文](README.md)

<!-- TODO: Add screenshot -->
<!-- ![screenshot](docs/assets/screenshot.png) -->

---

## Features

- **Full-pipeline creation** — Outlines, chapters, storyboards, and asset cards in one workspace
- **AI-assisted** — Generate, continue, polish, review, and make controlled edits; user-led, AI-assisted
- **Local-first** — Project files live on your machine; data never leaves your computer
- **Agent orchestration** — Skills / Workflows / nested sub-agents; LLM auto-invokes tools
- **Image generation + editing** — Text-to-image, local editing (brush/mask/crop), results go straight to asset library
- **Themes & i18n** — Light/dark/custom themes, Chinese & English, YAML-driven and extensible
- **Model freedom** — Connect any OpenAI-compatible endpoint, manage API keys locally

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron |
| Frontend | React · TypeScript · Zustand · TipTap |
| Agent | Custom Workflow Runtime (embedded library) |
| Model Protocol | Unified OpenAI-compatible adapter (AI SDK) |
| Build | pnpm monorepo · Turbo · Vite · Vitest |

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Electron Shell (main process)                   │
│  ├─ Model Gateway (text/image/video generation) │
│  ├─ @orison/desktop-agent (Workflow Runtime)    │
│  ├─ Local BFF (project file I/O)                │
│  └─ IPC security boundary + path sandbox        │
├─────────────────────────────────────────────────┤
│  Renderer                                        │
│  ├─ IDE-style workspace layout                  │
│  ├─ Creative editors (chapters/outline/board)   │
│  └─ Agent Panel (chat/skill/diff)               │
└─────────────────────────────────────────────────┘
```

## Repository Structure

```
apps/
  desktop/
    agent/          — @orison/desktop-agent (orchestration library)
    client/
      shell/        — Electron main process + preload
      ui/           — React renderer
    local-bff/      — Local project data layer
packages/
  model-protocols/  — Model protocol adapters (pure Node)
  shared-contracts/ — Cross-process type contracts (Zod schemas)
  story-sync/       — Story Sync extraction & patch logic
docs/               — Architecture & design docs
```

## Download

> Currently in Alpha — under active development.

Head to [GitHub Releases](https://github.com/LumenStorm/OrisonSpace/releases) to download the installer for your platform:

| Platform | Format |
|----------|--------|
| Windows | `.exe` installer |
| macOS | `.dmg` |
| Linux | `.AppImage` |

## Status

**Alpha** — Core creative pipeline (novel chapter generation/continuation/review, image generation, Agent orchestration) is functional. UI and features are being actively refined.

## License

[Apache-2.0](LICENSE)

## Contributing

Issues and Pull Requests are welcome.

- Bug reports: please include reproduction steps and system info
- Feature suggestions: please open an Issue for discussion first

<div align="center">

<img src="docs/assets/logo.png" alt="Orison Space — AI novel-writing IDE" width="120" />

# Orison Space

> AI-powered novel-writing IDE — a full-pipeline workspace from inspiration to final draft.

[中文](README.md)

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
![Status](https://img.shields.io/badge/status-Alpha-orange.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-37-47848F.svg)

[**⬇ Download**](https://github.com/LumenStorm/OrisonSpace/releases) · [📖 Docs](docs/) · [🕒 Timeline Guide](docs/guides/时间线指南.md) · [📋 Changelog](CHANGELOG.md)

</div>

<!-- TODO: Add screenshot -->
<!-- ![screenshot](docs/assets/screenshot.png) -->

---

**Orison Space** is an open-source, local-first AI novel-writing IDE for fiction and web-novel authors. It brings outlines, chapters, characters, and world-building asset cards into one workspace. Built on a "user-led, AI-assisted" principle, it offers AI generation, continuation, polishing, review, and controlled edits, connects to any OpenAI-compatible model, and keeps all of your writing on your own computer. It runs on Windows, macOS, and Linux under the Apache-2.0 license.

## Features

- **Full-pipeline creation** — Outlines, chapters, and asset cards in one workspace
- **AI-assisted** — Generate, continue, polish, review, and make controlled edits; user-led, AI-assisted
- **Local-first** — Project files live on your machine; data never leaves your computer
- **Agent orchestration** — Skills / Workflows / nested sub-agents; LLM auto-invokes tools
- **Image generation + editing** — Text-to-image, local editing (brush/mask/crop), results go straight to asset library
- **Version control** — isomorphic-git-based commit nodes, branches, diffs, and timeline
- **IDE-style editor** — Split view, minimap, multi-tab, command palette
- **Document interop** — DOCX preview, import, and export for chapters/outlines
- **Themes & i18n** — Light/dark/custom themes, Chinese & English, YAML-driven and extensible
- **Model freedom** — Connect any OpenAI-compatible endpoint, manage API keys locally

## Who it's for

- **Web-novel & long-form fiction authors** — who want outlines, chapters, and character bibles to live in one workspace instead of scattered across documents
- **Writers who want AI without giving up control** — Orison Space is a creative workspace, not a one-shot generator: every AI edit is previewable, controllable, and reversible
- **People who value privacy and data ownership** — your work is stored as local files, never uploaded, no account required
- **Bring-your-own-model users** — plug in your own OpenAI-compatible API key and freely choose text and image models

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
│  ├─ Model Gateway (text/image generation)           │
│  ├─ @orison/desktop-agent (Workflow Runtime)    │
│  ├─ Local BFF (project file I/O)                │
│  └─ IPC security boundary + path sandbox        │
├─────────────────────────────────────────────────┤
│  Renderer                                        │
│  ├─ IDE-style workspace layout                  │
│  ├─ Creative editors (chapters/outline)         │
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

Head to [GitHub Releases](https://github.com/LumenStorm/OrisonSpace/releases) to download the installer:

| Platform | Format |
|----------|--------|
| Windows | `.exe` installer / portable `.zip` |
| macOS | `.dmg` disk image |
| Linux | `.AppImage` portable executable |

## Status

**Alpha** — Core creative pipeline (novel chapter generation/continuation/review, image generation, Agent orchestration) is functional. UI and features are being actively refined.

## FAQ

**What is Orison Space?**
An open-source, local-first AI novel-writing IDE that brings outlines, chapters, characters, and world-building asset cards into one workspace, with AI generation, continuation, polishing, review, and controlled edits.

**How is it different from a chat tool like ChatGPT?**
It's a workspace for long-form writing, not a one-shot generator. Project structure, a version timeline, and an asset library persist over time; every AI edit is previewable, controllable, and reversible, and the user always leads the creation.

**Is my writing uploaded to the cloud?**
No. Orison Space is local-first. Your work is saved as plain files (`project.yaml`, `chapters/*.md`, etc.) on your own computer, with no account required and no data leaving your machine.

**Which AI models are supported?**
Any OpenAI-compatible endpoint. You connect with your own API key and freely choose text and image models; keys are stored encrypted, locally only.

**Which operating systems are supported?**
Windows, macOS (Intel and Apple Silicon), and Linux.

**Is it free? Is it open source?**
Fully open source under the Apache-2.0 license and free to use. You only bring your own model API usage.

## License

[Apache-2.0](LICENSE)

## Contributing

Issues and Pull Requests are welcome. Please read the [Contributing Guide](CONTRIBUTING.md) first.

- Bug reports: please include reproduction steps and system info
- Feature suggestions: please open an Issue for discussion first
- Security issues: please use private disclosure — see [SECURITY.md](SECURITY.md)

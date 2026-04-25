# Orison Space (OneLine2Video)

Orison Space is an AI-assisted creative workspace for long-form stories, scripts, storyboards, and video planning.

The product direction is a desktop-first creative IDE: AI generates and expands structured creative material, while the user reviews, edits, accepts, rejects, or reruns the result. The local project remains the authority for creative content; server and agent services provide authentication, task intake, orchestration, and generation support.

## Current Capabilities

- Desktop workspace built with Electron, React, TypeScript, Zustand, and CSS modules.
- Local-first project model for novel and script projects.
- Structured creative fields for brief, world setting, outline, episode outlines, growth curve, pacing curve, emotion curve, asset cards, and relationship graph.
- Fastify server for authentication, task APIs, database initialization, and orchestration proxying.
- Agent service for multi-agent orchestration runs, review actions, archive metadata, delivery output, and data feedback.
- Python node bridge for selected agent nodes.
- Shared Zod contracts for project documents, patches, creative fields, workflow sync, tasks, auth, IPC, and orchestration.

## Repository Layout

```text
OneLine2Video/
  apps/
    agent/                Multi-agent orchestration service
      prompts/            Agent prompt YAML files
      python/             Python node implementations
      src/                Fastify app, run engine, registry, contracts
      test/               Agent and orchestration tests
    desktop/
      shell/              Electron main, preload, and renderer shell
      ui/                 React UI, pages, features, Zustand store, styles
      local-bff/          Local project repository, field sync, desktop adapters
    server/               Remote API server, auth, tasks, orchestration proxy
  packages/
    shared-contracts/     Zod schemas and shared DTOs
    shared-utils/         Shared pure utilities
    ui-kit/               Shared UI package
    eslint-config/        Shared lint configuration
  docs/
    api/                  Server API notes
    ipc/                  Desktop IPC notes
    superpowers/          Design specs and implementation plans
  run.bat                 Windows development launcher
  pnpm-workspace.yaml     pnpm workspace definition
  turbo.json              Turborepo pipeline configuration
```

## Requirements

- Node.js 22 or newer
- pnpm 10 or newer
- PostgreSQL 14 or newer
- Python 3.10 or newer for Python-backed agent nodes

## Install

```bash
pnpm install
```

If Electron downloads are slow in your network environment, set an Electron mirror before installing dependencies.

```bash
# Windows
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# macOS / Linux
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
```

## Environment

The server reads `.env` through `tsx --env-file=.env`. The agent service reads `apps/agent/.env.agent`.

Server defaults:

```text
PORT=4000
DATABASE_URL=postgresql://postgres:root@localhost:5432/orison_dev
AGENT_URL=http://localhost:18422
JWT_SECRET=orison-dev-secret-key-NOT-FOR-PRODUCTION
DEMO_ACCESS_TOKEN=demo-access-token
```

Agent defaults:

```text
PORT=18422
LOG_LEVEL=info
```

On startup, the server checks whether the target PostgreSQL database exists and creates the `users` table if needed.

## Development

Start the full local development stack on Windows:

```bash
run.bat
```

Choose option `1` to start the agent service, server, and Electron desktop app together.

Common pnpm commands:

```bash
# Desktop app
pnpm dev

# Server only, default http://localhost:4000
pnpm dev:server

# Agent service only, default http://localhost:18422
pnpm dev:agent

# Build all packages and apps
pnpm build

# Build desktop app
pnpm build:desktop

# Build server
pnpm build:server
```

## Testing And Checks

```bash
# Run all tests through Turbo
pnpm test

# Type-check all workspaces
pnpm typecheck

# Run lint scripts
pnpm lint
```

Targeted examples:

```bash
pnpm --filter @orison/server test
pnpm --filter @orison/agent test
pnpm --filter @orison/desktop-ui test
pnpm --filter @orison/shared-contracts test
```

## Runtime Services

### Server

The server is the desktop client's remote API entrypoint. It owns:

- `/health`
- `/v1/auth/register`
- `/v1/auth/login`
- `/v1/tasks`
- `/v1/tasks/:taskId`
- `/v1/orchestration/*` proxy routes to the agent service

### Agent

The agent service owns orchestration execution:

- `/v1/orchestration/runs`
- `/v1/orchestration/runs/:runId`
- `/v1/orchestration/actions`

It supports the legacy orchestration request shape and the newer creative run request shape. Agent outputs are validated through shared contracts before being delivered back to the desktop workflow.

### Desktop

The Electron shell provides the native host surface and preload bridge. The React UI renders:

- Auth and project entry screens
- Workspace layout with side navigation, editor area, inspector, and task feed
- Creative field editors and review panels
- Orchestration run status and actions

The local BFF layer handles local project repository logic, field sync, and desktop-side adapters.

## Project Data Model

Project documents are validated with `projectDocumentSchema` from `@orison/shared-contracts`.

Core project areas:

- `meta`: project identity, type, version, timestamps
- `outline`: classic outline
- `detailed_outline`: scene or chapter planning
- `novel`: chapter list and content file references
- `script`: scene list, dialogue data, and content file references
- `storyboard`: shots and source references
- `video`: generated clip metadata
- `assets`: characters and locations
- `creative_*`: newer creative field structures used by the agent workflow

Agent-generated updates are returned as field-level patches and must be reviewed before they are applied.

## Development Conventions

- TypeScript strict mode.
- React function components and hooks.
- Zustand store split by responsibility.
- Zod schemas for all cross-process and cross-package contracts.
- Local project data is authoritative.
- Server and agent modules must not depend on desktop implementation details.
- `packages/shared-contracts` must stay framework-neutral.
- AI output should be structured, reviewable, and reversible.

## Useful Documentation

- [Server API](docs/api/server-api.md)
- [Desktop IPC](docs/ipc/desktop-ipc.md)
- [Data Dictionary](docs/data-dictionary.md)
- [UI Design](docs/ui-design.md)
- [Development Plan](docs/plan.md)
- [Design Specs](docs/superpowers/specs)
- [Implementation Plans](docs/superpowers/plans)

## License

Private.

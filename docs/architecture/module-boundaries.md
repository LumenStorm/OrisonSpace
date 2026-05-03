# Module Boundaries and Split Rules

> Status: active architecture rulebook. Keep this document in sync when UI, desktop IPC, or server module boundaries change.

## Goals

- Keep pages, features, services, and provider adapters independently understandable.
- Keep UI files focused on rendering and interaction, not filesystem, provider, or payload transformation details.
- Keep backend provider behavior replaceable without changing route contracts.
- Prefer explicit module ownership over large mixed files.

## Desktop UI

- `src/pages/*` are route-level entry files. A page may compose feature components and shared components, but should not own domain-heavy rendering, data transformation, or provider logic.
- `src/features/<domain>/*` own product domains such as editor, project tree, orchestration, novel workbench, memory, and auto mode.
- A feature entry component should mainly coordinate layout, state selection, and child view composition.
- Child views, reusable controls, hooks, pure helpers, and local types should live in separate files when they have their own responsibility.
- Tiny private JSX fragments may stay in the parent file only when they are tightly coupled to that parent and do not hide meaningful behavior.
- Pure tree, path, formatting, sorting, mapping, and payload-building logic belongs in `utils`, `treeUtils`, adapter, or hook files, not inside JSX render bodies.
- Shared UI primitives stay under `src/shared/components`; domain-specific components stay inside the owning feature.
- Store code stays sliced by responsibility. `appStore.ts` should compose slices, while slice files own their own state transitions.

## Desktop Shell and IPC

- IPC contracts are defined in `packages/shared-contracts/src/ipc.ts` and exposed through `shell/preload/index.ts`.
- Renderer code calls the preload API only. It should not import Electron or Node filesystem APIs.
- `shell/main/ipc/*Ipc.ts` files own IPC handlers by capability. Shared validation logic belongs in helper files such as `pathGuard.ts`.
- File and shell operations must pass path validation before touching disk.
- User-created projects live under `~/Documents/OrisonSpace`.
- Model config lives at `~/.orison/model/config.yaml`.
- User preferences live at `~/.orison/user/preferences.yaml`.
- No legacy compatibility should be added for the old `~/.orison/config.json` model path.
- Global user preferences currently include theme, locale, and auto-apply-patches. Layout, recent projects, and auth are intentionally excluded.

## Server

- Routes stay thin: validate input, select provider or service, and translate expected errors into HTTP responses.
- Services own business flow and capability dispatch.
- Provider implementations live under `apps/server/src/modules/<feature>/providers/<provider>/`.
- Provider-specific request and response mapping is isolated per provider and per capability.
- Shared request and response schemas live in `packages/shared-contracts`.
- Unsupported provider capabilities must fail explicitly with a provider error instead of returning partial or fake success.

## Generation Providers

- Generation routes use provider routing:
  - `POST /v1/generation/:provider/text`
  - `POST /v1/generation/:provider/image`
- Supported providers are `openai`, `gcp`, and `anthropic`.
- OpenAI-compatible, GCP, and Anthropic adapters stay in separate provider folders.
- Text and image capabilities stay in separate files inside each provider folder.
- Provider adapters should normalize external provider responses into shared contract response shapes.

## Documentation Rule

- When a session changes architecture boundaries, storage locations, IPC surface, or backend API shape, update both the root documentation and the matching `docs/` reference file.
- Keep rule documents threshold-free unless the team explicitly agrees to numeric thresholds.

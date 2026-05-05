# Module Boundaries and Split Rules

> Status: active architecture rulebook. Keep this document in sync when UI, desktop IPC, or server module boundaries change.

## Goals

- Keep pages, features, services, and provider adapters independently understandable.
- Keep UI files focused on rendering and interaction, not filesystem, provider, or payload transformation details.
- Keep backend provider behavior replaceable without changing route contracts.
- Prefer explicit module ownership over large mixed files.

## Desktop UI

- The renderer follows a Feature-Sliced–style layering: `app → pages → widgets → features → shared`. Higher layers may import lower layers; lower layers must not reach into higher layers.
- `src/app/*` contains the application root composition (top-level conditional routing, store bootstrap effects).
- `src/pages/*` are route-level entry files. A page may compose feature components and shared components, but should not own domain-heavy rendering, data transformation, or provider logic. Page subcomponents that are reusable across pages live under `widgets/`, not under the page folder.
- `src/widgets/*` host cross-feature page chrome. Examples: `widgets/layout/WorkspaceLayout.tsx` for the workspace shell, `widgets/projects/*` for project cards and empty states reused by the projects page.
- `src/features/<domain>/*` own product domains such as editor, project tree, orchestration, novel workbench, memory, and auto mode.
- A feature entry component should mainly coordinate layout, state selection, and child view composition.
- Child views, reusable controls, hooks, pure helpers, and local types should live in separate files when they have their own responsibility. When a feature accumulates more than one such helper file, group them under a sub-folder named after the feature aspect (e.g. `features/editor/file-editor/`, `features/inspector/image-gen-fields/`).
- Tiny private JSX fragments may stay in the parent file only when they are tightly coupled to that parent and do not hide meaningful behavior.
- Pure tree, path, formatting, sorting, mapping, and payload-building logic belongs in `utils`, `treeUtils`, adapter, or hook files, not inside JSX render bodies.
- Shared UI primitives stay under `src/shared/components`; domain-specific components stay inside the owning feature.
- Schemas and pure validation helpers consumed by more than one feature live under `src/shared/<domain>/` (for example `src/shared/imageGen/schema.ts`), not inside the feature that happens to render the form.
- All HTTP calls to the local server live under `src/shared/api/<area>.ts`. Slices and components import these helpers; they must not call `fetch` directly. This keeps slice files sliced by responsibility and makes API contracts trivially testable.
- Store code stays sliced by responsibility. `appStore.ts` only composes slices; slice files own their own state transitions. Long-lived domain state (orchestration runs, auto mode sessions, image generation params, etc.) is a slice — there is no parallel `useXyzStore` outside `useAppStore`.
- Slice errors are stored as either a translated message or an i18n key with a pipe-separated argument list (for example `orchestration.startFailed|500`). UI layers resolve the key through a small helper such as `features/orchestration/errors.ts` so slices stay UI-agnostic while components still render translated text.
- All user-visible text goes through the `t()` function from `shared/i18n/useI18n`. Tests that check translated strings should use tolerant regular expressions (raw-key OR translated-form) or `await screen.findByText(...)` to wait for async i18n loading.

## Desktop Shell and IPC

- IPC contracts are defined in `packages/shared-contracts/src/ipc.ts` and exposed through `shell/preload/index.ts`.
- Renderer code calls the preload API only. It should not import Electron or Node filesystem APIs.
- `shell/main/ipc/*Ipc.ts` files own IPC handlers by capability. Shared validation logic belongs in helper files such as `pathGuard.ts`.
- File and shell operations must pass path validation before touching disk.
- Generated image file operations stay project-scoped and may only write to `temp/images` or `assets/images`.
- New user-created projects default to `~/Documents/OrisonSpace`.
- User-selected project directories and selected cover image files are registered by the desktop shell as allowed roots for the current Electron session; this supports projects outside the default root without weakening project-relative escape checks.
- Model config lives at `~/.orison/model/index.yaml` and `~/.orison/model/profiles/*.yaml`; legacy `~/.orison/model/config.yaml` is migration-only.
- User preferences live at `~/.orison/user/preferences.yaml`.
- No legacy compatibility should be added for the old `~/.orison/config.json` model path.
- Global user preferences currently include theme, locale, and auto-apply-patches. Layout, recent projects, and auth are intentionally excluded.
- Model-list refresh is a desktop shell responsibility (`model:list-provider-models`), not a server route.

## Desktop Local BFF (Sync Layer)

- `apps/desktop/local-bff` is the desktop process local backend for project-directory persistence. It owns YAML-backed project data such as `project.yaml`, chapter files, sync state, and `memory/story-memory.yaml`.
- Renderer code must not import `local-bff` directly. Renderer writes flow through preload IPC, then `apps/desktop/shell/main/ipc/fieldSyncIpc.ts` validates the project path and creative field key before calling `local-bff` sync entry points such as `onFieldEdited(...)`.
- `local-bff` repositories stay Electron-agnostic and path-oriented so they can be tested outside the shell process and later extracted into a standalone service if needed.
- Field sync writes must pass `assertSafePath(projectPath)` and `creativeFieldKeySchema` validation before touching disk.
- The agent process may read project files for orchestration context, but desktop-originated writes remain owned by the shell IPC plus `local-bff` sync layer.

## Memory & RAG

- Story memory persists as `memory/story-memory.yaml` under each project and uses `StoryMemoryEntry` from `packages/shared-contracts` as its durable entry contract.
- Embedding fields on memory entries are optional. The default runtime path must keep working without embedding vectors, an embedding provider, or a vector database.
- Retrieval integrations should depend on the `MemoryRetriever` interface under `apps/agent/src/engine/memory/`, not on a specific embedding provider or storage engine.
- Chapter context may include `memoryHits`, but downstream nodes must tolerate an empty array until a concrete embedding provider and ranking strategy are selected.

## Story Sync Agent (Rules + Optional LLM)

- `apps/agent/src/nodes/story-sync-agent/` owns the chapter→creative-fields sync. It is split by responsibility: `rules.ts` (pure heuristic), `prompt.ts` (LLM messages), `parser.ts` (LLM JSON extraction + safety), and `index.ts` (dispatcher).
- Mode is selected by `ORISON_STORY_SYNC_MODE` (`rules` | `llm`, default `rules`). The default path remains rules-driven and zero-dependency for backward compatibility.
- LLM mode requires `ORISON_LLM_SERVER_URL` and routes through the server's `POST /v1/generation/:provider/text` adapter. LLM calls live in `apps/agent/src/engine/llmClient.ts` and never bypass the server's provider routing.
- Any LLM failure (network, HTTP, JSON, schema, or whitelist rejection) must fall back to the rules path; the node never surfaces an LLM error as a node failure.
- Both modes share the same safety contract on emitted patches: `action` is always `merge`; `field` must be in `creativeFieldKeys`; `fieldVersion` must equal the current context version for that field; `generatedBy` is forced to `'story-sync-agent'`; `runId`/`chapterId` are forced from the caller, never from the LLM.

## Auto Mode Persistence

- Auto mode session state is owned by `apps/agent/src/engine/autoMode/`. `novelAutoModeRunner.ts` is the per-session state machine; `autoModeService.ts` is the in-process registry plus background driver; `autoModeStore.ts` is the YAML persistence layer.
- Each session is serialized as `<projectPath>/runs/auto-mode/<autoModeId>.yaml` and stamped with `schemaVersion`. State transitions persist sequentially through `pendingPersist` to avoid interleaved writes.
- `POST /v1/orchestration/auto-mode/restore` rehydrates persisted sessions from a project path on demand. The route is the only public entry point for cross-process recovery; restored sessions are validated against `novelAutoModeStateSchema` and broken YAMLs are skipped.
- Persistence is additive: live `getState` always prefers the in-memory runner; the disk store is consulted only when no runner is registered for that `autoModeId`.

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
- Image generation service responses must include base64-ready image data (`b64Json`, `mimeType`, `dataUrl`) before reaching the desktop UI.
- Image response contracts accept OpenAI-style `b64_json`, camelCase `b64Json`, relay-style `base64`, and `data:image/*;base64,...` payloads, but UI code should consume the normalized `b64Json` and `dataUrl` fields.

## Documentation Rule

- When a session changes architecture boundaries, storage locations, IPC surface, or backend API shape, update both the root documentation and the matching `docs/` reference file.
- Keep rule documents threshold-free unless the team explicitly agrees to numeric thresholds.

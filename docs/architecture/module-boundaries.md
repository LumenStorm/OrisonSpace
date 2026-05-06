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

### Desktop Model Gateway

- `apps/desktop/shell/main/ipc/modelGatewayIpc.ts` (new) owns `model:generate-text`, `model:generate-image`, `model:generate-video`. It is the only place that decrypts `apiKey` for model calls.
- `apps/desktop/shell/main/ipc/modelProviderIpc.ts` keeps the `model:list-provider-models` channel; body delegates to `@orison/model-protocols.listModels(provider, ...)`.
- `apps/desktop/shell/main/ipc/configIpc.ts` handles the v2 profile schema. Each profile YAML carries a `models[]` list with `{id, alias, apiFormat, capabilities}`. Slot assignment in `~/.orison/model/index.yaml` is a `{profileId, modelId}` pair. v1 single-model profiles are migrated automatically on first read.
- `apps/desktop/shell/main/storySync/` (new directory) holds the LLM-driven story-sync extraction lifted out of agent: orchestrates "load slot → resolve profile (decrypt apiKey) → build messages via `@orison/story-sync` → call `model-protocols.generateText` → parse + safety-check → return patches". Renderer triggers it via `storySync:run` IPC.
- Renderer never sees a raw `apiKey` for the generation flow. Slot model passed across IPC contains only `{profileId, modelId}` plus non-secret display fields.

## Story-Sync

- Shared logic — prompt template, JSON parsing, patch safety validation — lives in `packages/story-sync/` and is imported by both `apps/desktop/shell/main/storySync/` (for execution) and `apps/agent/src/nodes/story-sync-agent/` (for validation of incoming pre-computed patches).
- The package is pure TS — no Fastify, no Electron, no IO. Allowed dependencies: `@orison/shared-contracts`, `zod`.
- `parseStorySyncResponse(text, ctx)` is used by desktop main to parse an LLM text response into safe patches.
- `parseStorySyncPatches(rawPatches, ctx)` is used by agent to revalidate pre-computed patches received in `artifacts['chapter.llmPatches']`. Treats input as untrusted.
- `enforcePatchSafety(patches, ctx)` is the shared kernel that both entry points share — whitelist field, `action='merge'`, `fieldVersion` matches context, `generatedBy` forced to `'story-sync-agent'`.

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

## Story Sync Agent (Rules + Pre-Computed Patches)

- Desktop owns LLM execution. The story-sync LLM-driven extraction runs in `apps/desktop/shell/main/storySync/` (using `@orison/story-sync` for prompt + parser + safety). Renderer triggers it via the `storySync:run` IPC channel before posting an orchestration run; main returns safe patches that the renderer embeds under `artifacts['chapter.llmPatches']` of the run body.
- `apps/agent/src/nodes/story-sync-agent/` runs only the rules path **plus** a pre-computed-patches branch. The pre-computed branch reads `artifacts['chapter.llmPatches']` from the run input, validates each patch via `parseStorySyncPatches` from `@orison/story-sync` (whitelist field, `action='merge'`, `fieldVersion` matches context, `generatedBy` forced to `'story-sync-agent'`, `runId/chapterId` forced from caller), and emits the safe subset.
- Validation failure or missing field → fall back to the rules path. The agent never holds an `apiKey` and never opens an outbound HTTPS connection to a model provider; if a code path tries to, treat it as a regression.
- Rules path (`rules.ts`) is unchanged from before — pure heuristic, no IO, no LLM. It is the agent's only fallback.
- The shared safety contract on emitted patches: `action` is always `merge`; `field` must be in `creativeFieldKeys`; `fieldVersion` must equal the current context version for that field; `generatedBy` is forced to `'story-sync-agent'`; `runId`/`chapterId` are forced from the caller, never from the LLM.

## Auto Mode Persistence

- Auto mode session state is owned by `apps/agent/src/engine/autoMode/`. `novelAutoModeRunner.ts` is the per-session state machine; `autoModeService.ts` is the in-process registry plus background driver; `autoModeStore.ts` is the YAML persistence layer.
- Each session is serialized as `<projectPath>/runs/auto-mode/<autoModeId>.yaml` and stamped with `schemaVersion`. State transitions persist sequentially through `pendingPersist` to avoid interleaved writes.
- `POST /v1/orchestration/auto-mode/restore` rehydrates persisted sessions from a project path on demand. The route is the only public entry point for cross-process recovery; restored sessions are validated against `novelAutoModeStateSchema` and broken YAMLs are skipped.
- Persistence is additive: live `getState` always prefers the in-memory runner; the disk store is consulted only when no runner is registered for that `autoModeId`.

## Server

- Routes stay thin: validate input, select service, and translate expected errors into HTTP responses.
- Server owns only resource-state routes (`auth`, `project`, `task`) and the orchestration proxy (`/v1/orchestration/*`). The entire `apps/server/src/modules/generation/` tree was deleted in 2026-05-07; server no longer opens an outbound HTTPS connection to any model provider.
- The orchestration proxy forwards `runs`, `actions`, `auto-mode`, `auto-mode/actions`, `auto-mode/:id`, and `auto-mode/restore` to `${AGENT_URL}` with `Authorization` preserved.
- Server is the only public-facing process; agent is reachable only through the proxy. JWT validation runs in `authPlugin` before any proxy forward.
- Shared request and response schemas live in `packages/shared-contracts`.

## Generation Providers

- All provider/protocol adapters live in `packages/model-protocols/`. The package is pure Node — no Fastify, no Electron, no `dotenv`, no filesystem side-effects beyond `node:buffer`. Server **must not** import this package; only `apps/desktop/shell/main` does.
- The package draws a clear line between two concerns:
  - **`listModels(provider, ...)`** routes by `provider` (`openai` / `anthropic` / `gcp`). One implementation per provider; NewAPI-style relays piggyback on `provider='openai'`.
  - **`generate{Text,Image,Video}(profile, request, ctx)`** routes by the model entry's `apiFormat`. One adapter file per format under `protocols/<apiFormat>.ts`.
- Shipping `apiFormat` values and their owners:
  - `openai-chat-completions` → `protocols/openaiChat.ts` (text)
  - `openai-responses` → `protocols/openaiResponses.ts` (text)
  - `claude-messages` → `protocols/claudeMessages.ts` (text)
  - `gemini-generate-content` → `protocols/geminiGenerateContent.ts` (text)
  - `openai-images` → `protocols/openaiImages.ts` (image)
  - `gemini-images` → `protocols/geminiImages.ts` (image)
  - `sora-videos` → `protocols/soraVideos.ts` (video; placeholder, throws `ProtocolNotImplementedError`)
- Each adapter exposes only the verbs that format supports; unsupported verbs throw `ProtocolCapabilityError`. Adapters consume and return shapes from `@orison/shared-contracts`. Image responses are normalized to `b64Json + mimeType + dataUrl` inside the adapter.

## Documentation Rule

- When a session changes architecture boundaries, storage locations, IPC surface, or backend API shape, update both the root documentation and the matching `docs/` reference file.
- Keep rule documents threshold-free unless the team explicitly agrees to numeric thresholds.

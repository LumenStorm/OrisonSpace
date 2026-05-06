# Server API Reference

## Base URL

`http://localhost:4000`

## Authentication

All endpoints except `/health` and `/v1/auth/*` require a `Bearer` token in the `Authorization` header.

## Endpoints

### GET /health

Returns server health status.

Response: `{ "status": "ok" }`

### POST /v1/auth/register

Create a new user account.

Request body:

```json
{
  "email": "creator@example.com",
  "password": "secret123",
  "displayName": "Creator"
}
```

Response (201):

```json
{
  "accessToken": "string",
  "tokenType": "Bearer",
  "user": {
    "id": "string",
    "email": "creator@example.com",
    "displayName": "Creator"
  }
}
```

Errors:
- `400`: Invalid input
- `409`: Email already registered

### POST /v1/auth/login

Request body:

```json
{
  "email": "creator@example.com",
  "password": "secret123"
}
```

Response (200):

```json
{
  "accessToken": "string",
  "tokenType": "Bearer",
  "user": {
    "id": "string",
    "email": "creator@example.com",
    "displayName": "Creator"
  }
}
```

Errors:
- `401`: Invalid email or password

### POST /v1/projects

Register a local project and allocate a sequential five-digit `projectId`.

Request body:

```json
{
  "name": "Cold City",
  "type": "novel",
  "localFingerprint": "C:/Projects/ColdCity"
}
```

Response (201):

```json
{
  "projectId": "00001",
  "name": "Cold City",
  "type": "novel"
}
```

Behavior notes:
- If the same `localFingerprint` is submitted again, the server returns the existing project record instead of creating a duplicate.

### POST /v1/tasks

Submit a task for execution.

Request body (validated by `taskRequestSchema`):

```json
{
  "projectId": "00001",
  "targetId": "act_1",
  "assetIds": ["char_001", "loc_002"],
  "type": "outline.rewrite",
  "name": "重写第一幕冲突",
  "description": "强化主角和对手第一次正面冲突",
  "input": "让冲突更紧张。"
}
```

Field notes:
- `projectId`: five-digit project ID
- `targetId`: optional target entity ID
- `assetIds`: optional related asset IDs
- `type`: task type string
- `name`: human-readable task name
- `description`: task intent summary
- `input`: text payload passed to execution

Response (202):

```json
{
  "taskId": "20260427214530123_48321",
  "status": "queued"
}
```

Errors:
- `404`: Project not found
- `400`: Invalid request body

### GET /v1/tasks/:taskId

Retrieve the persisted task result. **Returns the bare `TaskResult` for backward compatibility with the desktop local-bff.** For metadata + result together, use `GET /v1/tasks/:taskId/detail`.

Response (validated by `taskResultSchema`):

```json
{
  "taskId": "20260427214530123_48321",
  "status": "completed",
  "outputType": "patch",
  "outputPayload": {
    "operations": [
      {
        "op": "replace",
        "path": "story.acts[0].summary",
        "value": "Rewritten: Make the opening darker."
      }
    ]
  },
  "summary": "Mock rewrite completed.",
  "rationale": "The mock adapter echoes the requested direction.",
  "reviewHint": "Confirm the patch targets the intended act.",
  "retryable": true
}
```

Errors:
- `404`: Task not found

### GET /v1/tasks/:taskId/detail

Retrieve task metadata and result together.

Response (validated by `taskDetailResponseSchema`):

```json
{
  "task": {
    "taskId": "20260427214530123_48321",
    "projectId": "00001",
    "targetId": "act_1",
    "type": "outline.rewrite",
    "name": "重写第一幕冲突",
    "description": "强化主角和对手第一次正面冲突",
    "status": "completed",
    "createdAt": "2026-04-27T14:45:30.123Z",
    "assetIds": ["char_001", "loc_002"]
  },
  "result": {
    "taskId": "20260427214530123_48321",
    "status": "completed",
    "outputType": "patch",
    "outputPayload": { "operations": [] },
    "summary": "Mock rewrite completed.",
    "retryable": true
  }
}
```

Behavior notes:
- `result` is `null` when no execution result has been persisted yet (task still queued/running).
- `task.assetIds` is hydrated through a single `task_asset_refs` lookup.

Errors:
- `404`: Task not found

### GET /v1/projects/:projectId/tasks

List persisted tasks for a project (keyset pagination).

Query params (validated by `taskListQuerySchema`):
- `limit`: 1–200, default `50`
- `cursor`: opaque base64url cursor returned by a previous page (omit for first page)
- `sort`: `createdDesc` (default) or `createdAsc`

Response (validated by `taskListResponseSchema`, 200):

```json
{
  "items": [
    {
      "taskId": "20260427214530123_48321",
      "projectId": "00001",
      "targetId": "act_1",
      "type": "outline.rewrite",
      "name": "重写第一幕冲突",
      "description": "强化主角和对手第一次正面冲突",
      "status": "completed",
      "createdAt": "2026-04-27T14:45:30.123Z",
      "assetIds": ["char_001", "loc_002"]
    }
  ],
  "nextCursor": "eyJ0cyI6IjIwMjYtMDQtMjdUMTQ6NDU6MzAuMTIzWiIsImlkIjoiMjAyNjA0MjcyMTQ1MzAxMjNfNDgzMjEifQ"
}
```

Behavior notes:
- Keyset pagination on `(created_at, task_id)`. Pass `nextCursor` from the previous response to fetch the next page; `nextCursor` is `null` when there are no more rows.
- Asset IDs are hydrated with a single batched lookup, avoiding per-task N+1 queries.

Errors:
- `404`: Project not found

### GET /v1/projects/:projectId/assets

List lightweight asset index entries for a project (keyset pagination).

Query params (validated by `projectAssetListQuerySchema`):
- `limit`: 1–200, default `50`
- `cursor`: opaque base64url cursor (omit for first page)
- `sort`: `updatedDesc` (default) or `updatedAsc`

Response (validated by `projectAssetListResponseSchema`, 200):

```json
{
  "items": [
    {
      "assetId": "char_001",
      "projectId": "00001",
      "assetType": "unknown",
      "assetName": "char_001",
      "assetStatus": "active",
      "sourceTaskId": "20260427214530123_48321",
      "summary": "强化主角和对手第一次正面冲突",
      "version": 1,
      "updatedAt": "2026-04-27T14:45:30.456Z"
    }
  ],
  "nextCursor": null
}
```

Behavior notes:
- Keyset pagination on `(updated_at, asset_id)`.
- The current server writes placeholder index metadata for task-linked assets:
  - `assetType = "unknown"`
  - `assetName = assetId`
  - `assetStatus = "active"`
- `version` is incremented on upsert for the same `(projectId, assetId)`.

Errors:
- `404`: Project not found

## Limits and Notes

- Request body limit: `1 MB`
- Task execution is currently backed by the mock adapter.
- `GET /v1/tasks/:taskId` returns the bare `TaskResult` for backward compatibility; use `GET /v1/tasks/:taskId/detail` to fetch task metadata + result together.
- Project task and asset list endpoints use keyset pagination — pass `nextCursor` from the previous response to fetch the next page.
- Generation provider contracts live in `packages/shared-contracts/src/contracts/generation.ts`. They describe the request/response shapes that travel **inside the desktop main process** and through the desktop IPC layer; the server itself no longer exposes generation routes (see "Removed in 2026-05-07").

## Model List Refresh

The desktop model settings page does not use a custom Orison server endpoint for model lists.

It asks the Electron desktop main process to refresh model choices from the configured model provider base URL, avoiding renderer CORS limits. Listing is **provider-routed** (one HTTP shape per provider), and the request body is delegated to `@orison/model-protocols.listModels(provider, ...)`:
- OpenAI / NewAPI relay (`provider='openai'`): `GET {baseUrl}/v1/models` with `Authorization: Bearer {apiKey}`
- Anthropic (`provider='anthropic'`): `GET {baseUrl}/v1/models` with `x-api-key: {apiKey}` and `anthropic-version: 2023-06-01`
- GCP / Gemini (`provider='gcp'`): `GET {baseUrl}/v1beta/models?key={apiKey}` with `x-goog-api-key: {apiKey}`

After listing, the user assigns each model entry an `alias` and an `apiFormat` (auto-suggested via `inferApiFormat`). `apiFormat` — not `provider` — is what later drives generation request shape, so a Claude id served via a NewAPI relay can sit in a `provider='openai'` profile while still being marked `apiFormat='openai-chat-completions'`.

Model profile config is stored as `~/.orison/model/index.yaml` plus one YAML file per profile under `~/.orison/model/profiles/`. Each profile YAML carries a `models[]` list with `{id, alias, apiFormat, capabilities}` per entry. Slot assignment in `index.yaml` is a `{profileId, modelId}` pair.

## Removed in 2026-05-07

The `/v1/generation/:provider/text` and `/v1/generation/:provider/image` routes were removed by the desktop-direct model gateway migration. Every third-party model HTTP call (text, image, video) now originates on the user's machine in the Electron desktop main process, dispatched via `@orison/model-protocols`. The server no longer holds, forwards, or proxies provider `apiKey`s.

See:
- `docs/superpowers/specs/2026-05-06-desktop-model-gateway-design.md` — design spec.
- `docs/superpowers/plans/2026-05-06-desktop-model-gateway-migration.md` — migration plan.
- `docs/ipc/desktop-ipc.md` — replacement IPC channels (`model:generate-text`, `model:generate-image`, `model:generate-video`, `storySync:run`).

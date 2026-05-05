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
- Generation provider contracts live in `packages/shared-contracts/src/contracts/generation.ts`.

## Generation APIs

### POST /v1/generation/:provider/text

Generate text through a provider adapter.

Path params:
- `provider`: `openai`, `gcp`, or `anthropic`

Request body:

```json
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are a story editor." },
    { "role": "user", "content": "Write a short scene outline." }
  ],
  "apiKey": "optional-provider-key",
  "baseUrl": "https://api.openai.com/v1",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

Response (200):

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "text": "Generated text.",
  "raw": {}
}
```

Behavior notes:
- OpenAI-compatible providers call `chat/completions`.
- GCP providers call `models/{model}:generateContent`.
- Anthropic providers call `/v1/messages`.

### POST /v1/generation/:provider/image

Generate images through a provider adapter.

Path params:
- `provider`: `openai`, `gcp`, or `anthropic`

Request body:

```json
{
  "model": "gpt-image-1",
  "prompt": "A cinematic neon city street at night",
  "apiKey": "optional-provider-key",
  "baseUrl": "https://api.openai.com/v1",
  "size": "1024x1024",
  "n": 1
}
```

Response (200):

```json
{
  "provider": "openai",
  "model": "gpt-image-1",
  "images": [
    {
      "url": "https://example.com/image.png",
      "b64Json": "base64-image-payload",
      "mimeType": "image/png",
      "dataUrl": "data:image/png;base64,base64-image-payload"
    }
  ],
  "raw": {}
}
```

Behavior notes:
- OpenAI-compatible providers call `images/generations` and request `response_format: "b64_json"`.
- GCP providers call `models/{model}:predict`.
- Anthropic image generation is currently unsupported and returns a provider error.
- The server normalizes successful image responses so each image includes `b64Json`, `mimeType`, and `dataUrl`.
- OpenAI-compatible relay responses may return `b64_json`, `b64Json`, `base64`, or a `data:image/*;base64,...` payload. The shared contract and server normalizer collapse these forms into the canonical `b64Json` field.
- If a provider returns only a URL, the server downloads the image into `temp/generation-images`, converts it to base64, and keeps the original `url` on the response.
- The desktop renderer previews generated images via `dataUrl`; project file creation is performed by the desktop shell through `project:save-base64-image`.

## Model List Refresh

The desktop model settings page does not use a custom Orison server endpoint for model lists.

It asks the Electron desktop main process to refresh model choices from the configured model provider base URL, avoiding renderer CORS limits:
- OpenAI/New API compatible: `GET {baseUrl}/models`
- Gemini/GCP compatible: `GET {baseUrl}/models?key={apiKey}`

Headers are selected by provider:
- `openai`: `Authorization: Bearer {apiKey}`
- `anthropic`: `x-api-key: {apiKey}` and `anthropic-version: 2023-06-01`
- `gcp`: `x-goog-api-key: {apiKey}`, with `key` query parameter also included

The desktop settings page stores reusable model profiles. The response is normalized by the desktop shell into model IDs and capabilities, then saved as profiles that can be assigned to `novel`, `image`, and `video`.

Model profile config is stored as `~/.orison/model/index.yaml` plus one YAML file per model under `~/.orison/model/profiles/`.

The bottom Properties panel reads the selected image model from this same profile library. The server does not expose or own a model-list endpoint.

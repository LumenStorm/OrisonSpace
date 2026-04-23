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

Request body: `{ "email": string, "password": string (min 6), "displayName"?: string }`

Response (201): `{ "accessToken": string, "tokenType": "Bearer", "user": { "id": string, "email": string, "displayName": string } }`

Errors:
- 400: Invalid input
- 409: Email already registered

### POST /v1/auth/login

Request body: `{ "email": string, "password": string }`

Response (200): `{ "accessToken": string, "tokenType": "Bearer", "user": { "id": string, "email": string, "displayName": string } }`

Errors:
- 401: Invalid email or password

### POST /v1/tasks

Submit an AI task for execution.

Request body (validated by `taskRequestSchema`):
- `taskId`: string
- `taskType`: string (e.g. `story.rewrite`)
- `projectFingerprint`: string
- `selectedScope`: `{ module: "story" | "script" | "storyboard" | "video", entityId?: string }`
- `contextPayload`: record of key-value pairs
- `userInstruction`: string
- `privacyLevel`: `"minimal"` | `"standard"`
- `expectedOutputType`: `"patch"` | `"candidate"`

Response (202): `{ "taskId": string, "status": "queued" }`

### GET /v1/tasks/:taskId

Retrieve task status and result.

Response (validated by `taskResultSchema`):
- `taskId`: string
- `status`: `"queued"` | `"running"` | `"completed"` | `"failed"`
- `outputType?`: `"patch"` | `"candidate"`
- `outputPayload?`: `{ operations: PatchOperation[] }`
- `summary`: string
- `rationale`: string
- `reviewHint`: string
- `retryable`: boolean

## Limits

- Request body limit: 1 MB
- Task cache TTL: 15 minutes

# 服务端 API 参考

## Base URL

默认本地开发地址：
`http://localhost:4000`

## 鉴权

除以下接口外，所有接口都要求 `Authorization: Bearer <token>`：

- `GET /health`
- `POST /v1/auth/register`
- `POST /v1/auth/login`

## 密码传输安全

登录和注册接口的 `password` 字段由客户端先计算 `SHA-256(password + "orison:auth:v1")`，再以十六进制字符串传输给服务端。
服务端直接对收到的摘要做 bcrypt 存储与校验。

## 接口列表

### GET /health

健康检查。
响应：

```json
{
  "status": "ok"
}
```

---

### POST /v1/auth/register

注册用户。
请求体：

```json
{
  "email": "creator@example.com",
  "password": "<SHA-256(password + app salt) hex string>",
  "displayName": "Creator"
}
```

成功响应 `201`：

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

错误：

- `400`：输入不合法
- `409`：邮箱已注册

---

### POST /v1/auth/login

用户登录。
请求体：

```json
{
  "email": "creator@example.com",
  "password": "<SHA-256(password + app salt) hex string>"
}
```

成功响应 `200`：

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

错误：

- `400`：输入不合法
- `401`：邮箱或密码错误

---

### GET /v1/auth/me

获取当前 token 对应的用户信息。
成功响应 `200`：

```json
{
  "user": {
    "id": "string",
    "email": "creator@example.com",
    "displayName": "Creator"
  }
}
```

说明：

- 桌面端启动时会调用这个接口做 session bootstrap
- 如果 token 过期或无效，会返回 `401`

---

### POST /v1/projects

当前 server 版本不再提供此接口。项目登记和最近项目列表由桌面端本地项目层负责。

---

### POST /v1/tasks

当前 server 版本不再提供此接口。后台任务持久化由桌面主进程写入本地 SQLite。

---

### GET /v1/tasks/:taskId

当前 server 版本不再提供此接口。任务结果由桌面端本地任务层读取和恢复。

---

### GET /v1/tasks/:taskId/detail

当前 server 版本不再提供此接口。任务元数据与结果在桌面端本地层合并展示。

---

### GET /v1/projects/:projectId/tasks

当前 server 版本不再提供此接口。任务列表由桌面端本地层按项目读取。

---

### GET /v1/projects/:projectId/assets

当前 server 版本不再提供此接口。项目资产索引由本地项目目录与创作字段同步逻辑维护。

---

## Orchestration 代理

服务端不自己执行编排逻辑，而是转发到 Agent：

- `POST /v1/orchestration/runs`
- `GET /v1/orchestration/runs/:runId`
- `POST /v1/orchestration/actions`
- `POST /v1/orchestration/auto-mode`
- `POST /v1/orchestration/auto-mode/actions`
- `GET /v1/orchestration/auto-mode/:autoModeId`
- `POST /v1/orchestration/auto-mode/restore`

转发行为：

- 保留调用方的 `Authorization`
- 保留上游状态码
- JSON 与纯文本响应都可透传

---

## 已移除接口

以下接口已在 desktop-direct model gateway 迁移中移除：

- `POST /v1/generation/:provider/text`
- `POST /v1/generation/:provider/image`

当前第三方模型调用方式：

- renderer -> Electron preload -> desktop main IPC
- desktop main -> `@orison/model-protocols`
- desktop main 直接请求第三方模型服务

也就是说：

- server 不再持有 provider `apiKey`
- server 不再转发模型请求
- agent 也不再直接访问模型

---

## 模型列表刷新说明

模型列表刷新不是服务端接口，而是桌面主进程能力。
桌面端通过 `model:list-remote-models` IPC 触发：

- 统一请求 `{baseUrl}/v1/models`（OpenAI 兼容层）
- 覆盖直连 OpenAI、NewAPI/OneAPI 中继等 provider
- 模型能力和别名由 `model-registry` 推断

生成请求使用 `ModelRef`：`{ keyId, modelId }`。

---

## 其他约束

- 请求体大小限制：`1 MB`
- CORS 白名单：
- `http://localhost:5173`
- `http://localhost:4000`
- `app://.`

---

## 相关文档

- [桌面 IPC 参考](../ipc/desktop-ipc.md)
- [模块边界规则](../architecture/module-boundaries.md)
- [数据字典](../data-dictionary.md)

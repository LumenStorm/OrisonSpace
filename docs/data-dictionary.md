# Orison Space 数据字典

## 1. 数据边界总览

系统采用“本地创作文件 + 服务端元数据”双层结构：

- 本地项目目录负责创作正文与创作字段
- PostgreSQL 负责用户、项目登记、任务与资产索引
- 桌面主进程负责模型配置与 provider 调用

## 2. PostgreSQL（服务端）

服务端数据库由 `apps/server/src/common/db.ts` 初始化，主要表如下。

### 2.1 users

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | UUID | PK, default `gen_random_uuid()` | 用户 ID |
| `email` | VARCHAR(255) | UNIQUE NOT NULL | 登录邮箱 |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt 哈希 |
| `display_name` | VARCHAR(100) | 可空 | 显示名称 |
| `created_at` | TIMESTAMPTZ | default now() | 创建时间 |

### 2.2 projects

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `project_id` | VARCHAR(5) | PK | 五位顺序项目号（如 `00001`） |
| `project_name` | VARCHAR(255) | NOT NULL | 项目名称 |
| `project_type` | VARCHAR(32) | NOT NULL | `novel` / `script` |
| `local_fingerprint` | VARCHAR(255) | UNIQUE NOT NULL | 本地项目指纹 |
| `created_at` | TIMESTAMPTZ | NOT NULL | 创建时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 更新时间 |

### 2.3 tasks

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `task_id` | VARCHAR(32) | PK | 服务端生成任务号 |
| `project_id` | VARCHAR(5) | FK -> projects | 所属项目 |
| `target_id` | VARCHAR(128) | 可空 | 目标实体 |
| `task_type` | VARCHAR(64) | NOT NULL | 任务类型 |
| `name` | VARCHAR(255) | NOT NULL | 任务名 |
| `description` | TEXT | NOT NULL | 任务描述 |
| `input_text` | TEXT | NOT NULL | 输入文本 |
| `status` | VARCHAR(32) | NOT NULL | queued/running/completed/failed |
| `output_type` | VARCHAR(32) | 可空 | 输出类型 |
| `output_payload` | JSONB | 可空 | 输出负载 |
| `result_summary` | TEXT | 可空 | 结果摘要 |
| `rationale` | TEXT | NOT NULL DEFAULT '' | 解释 |
| `review_hint` | TEXT | NOT NULL DEFAULT '' | 审核提示 |
| `retryable` | BOOLEAN | NOT NULL DEFAULT TRUE | 是否可重试 |
| `error_message` | TEXT | 可空 | 错误信息 |
| `created_at` | TIMESTAMPTZ | NOT NULL | 创建时间 |
| `started_at` | TIMESTAMPTZ | 可空 | 开始时间 |
| `finished_at` | TIMESTAMPTZ | 可空 | 结束时间 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 更新时间 |

### 2.4 task_asset_refs

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `task_id` | VARCHAR(32) | FK -> tasks ON DELETE CASCADE | 任务 ID |
| `asset_id` | VARCHAR(128) | PK(task_id, asset_id) | 关联资产 ID |

### 2.5 project_assets

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `project_id` | VARCHAR(5) | PK(project_id, asset_id), FK -> projects ON DELETE CASCADE | 项目 ID |
| `asset_id` | VARCHAR(128) | PK(project_id, asset_id) | 资产 ID |
| `asset_type` | VARCHAR(32) | NOT NULL | 当前多为 `unknown` |
| `asset_name` | VARCHAR(255) | NOT NULL | 资产名 |
| `asset_status` | VARCHAR(32) | NOT NULL | 状态 |
| `source_task_id` | VARCHAR(32) | 可空 | 来源任务 |
| `summary` | TEXT | 可空 | 摘要 |
| `version` | INTEGER | NOT NULL DEFAULT 1 | 版本 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 更新时间 |

关键点：

- 主键是 `(project_id, asset_id)`，避免跨项目同名资产冲突
- 任务列表和资产列表都走 keyset 分页

## 3. 本地项目文件（创作内容主存）

典型目录结构：

```text
<project>/
├─ project.yaml
├─ chapters/
│  ├─ ch-001.md
│  └─ ...
├─ scenes/
│  ├─ sc-001.md
│  └─ ...
├─ memory/
│  └─ story-memory.yaml
├─ temp/
│  └─ images/
│     └─ generation/
└─ assets/
   └─ images/
```

说明：

- `project.yaml` 存放结构化字段（大纲、曲线、资产卡等）
- `chapters/*.md` / `scenes/*.md` 存放正文
- `memory/story-memory.yaml` 存放长期记忆索引
- `temp/images/generation` 存放新生成图片与本地编辑结果（待确认）
- `assets/images` 存放已确认保存的图片资产

## 4. 模型配置存储（桌面主进程）

模型配置不在服务端数据库中，位于用户目录：

- `~/.orison/model/keys/*.yaml`

### 4.1 key 文件（凭据 + 发现的模型）

```yaml
id: key_001
name: OpenAI 主配置
baseUrl: https://api.openai.com
apiKey: <ciphertext>
models:
  - id: gpt-4o
    capability: text
    alias: GPT-4o
    enabled: true
  - id: gpt-image-1
    capability: image
    alias: GPT Image
    enabled: true
```

说明：

- `apiKey` 落盘是加密密文（Electron `safeStorage`）
- 只有 desktop main 会解密
- 渲染层、服务端、agent 都不持有 provider 明文 key
- `models[]` 从远端 `/v1/models` 发现后，由 `model-registry` 自动推断 `capability` 和 `alias`
- `enabled` 控制模型是否在 UI 中可选

## 5. 用户偏好

用户偏好存储：

- `~/.orison/user/preferences.yaml`

当前字段：

```yaml
theme: system
locale: system
autoApplyPatches: true
```

## 6. 鉴权会话数据

渲染层本地缓存：

- `localStorage` 中的 `orison_token`
- `localStorage` 中的 `orison_user`

启动时行为：

- 若有 token，先请求 `GET /v1/auth/me`
- 成功后同步最新 user 到 store
- 401 视为会话过期，清空本地会话并回到登录页
- 非 401 失败进入匿名态并保留错误信息

## 7. Orchestration / Auto Mode 相关文件

Agent 侧 auto mode 持久化位置：

```text
<projectPath>/runs/auto-mode/<autoModeId>.yaml
```

用于：

- 进程重启后的会话恢复
- `POST /v1/orchestration/auto-mode/restore` 回放

## 8. 已废弃/迁移说明

### 8.1 服务端 generation route

以下路由已移除（2026-05-07）：

- `/v1/generation/:provider/text`
- `/v1/generation/:provider/image`

生成请求改为桌面 IPC：

- `model:generate-text`
- `model:generate-image`
- `model:generate-video`

### 8.2 旧模型配置路径

旧路径 `~/.orison/model/config.yaml`、`~/.orison/model/index.yaml`、`~/.orison/model/profiles/*.yaml` 只用于迁移读取，不再作为长期写入格式。

---

## 9. 字段关系要点

| 源字段 | 目标字段 | 说明 |
|---|---|---|
| `tasks.project_id` | `projects.project_id` | 任务所属项目 |
| `task_asset_refs.task_id` | `tasks.task_id` | 任务资产关联 |
| `project_assets.project_id` | `projects.project_id` | 项目资产索引 |
| `modelConfig.keys[].models[].id` | `ModelRef.modelId` | 生成请求模型引用 |
| `storyboard.shots[].source_ref` | novel/script 实体 ID | 分镜来源引用 |

---

## 10. 备注

- 本文档描述的是当前代码实现对应的数据结构，不是早期设计草案。
- 若后续对 auth 启动流程、模型配置 schema、任务索引字段有调整，必须同步更新本文档。

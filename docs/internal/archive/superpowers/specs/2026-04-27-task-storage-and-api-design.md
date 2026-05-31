# 任务存储与接口设计

## 目标

定义一套已经和当前代码实现对齐的任务持久化与项目索引方案：

1. `project_id` 使用五位左补零顺序号。
2. `task_id` 由服务端生成，格式为 `YYYYMMDDHHmmssSSS_<random5>`。
3. PostgreSQL 只承载项目元数据、任务流水、任务资产引用和轻量资产索引。
4. 大段创作正文、完整资产详情和本地项目文件继续留在本地明文。

## 当前实现概览

服务端当前已落地以下接口：

- `POST /v1/projects`
- `POST /v1/tasks`
- `GET /v1/tasks/:taskId`
- `GET /v1/projects/:projectId/tasks`
- `GET /v1/projects/:projectId/assets`

桌面端当前已落地以下行为：

- 新建项目时会尝试向服务端注册项目，并把返回的 `projectId` 写回本地项目元数据。
- 打开本地项目时，如果本地元数据还没有 `projectId`，会尝试补注册。
- 提交任务时必须带上已登记的 `projectId`，不再依赖客户端自造 `taskId`。

## ID 规则

### `project_id`

- 类型：`varchar(5)`
- 规则：五位顺序号，左补零
- 示例：`00001`、`00002`

当前实现通过 PostgreSQL 事务内的 `pg_advisory_xact_lock` 分配下一个顺序号，并在同一事务里完成插入。

### `task_id`

- 类型：`varchar(32)`
- 规则：`YYYYMMDDHHmmssSSS_<random5>`
- 示例：`20260427214530123_48321`

当前实现按本地时间拼接 17 位时间戳，再追加五位随机数。

## 请求与响应

### `POST /v1/projects`

请求体：

```json
{
  "name": "Cold City",
  "type": "novel",
  "localFingerprint": "C:/Projects/ColdCity"
}
```

响应体：

```json
{
  "projectId": "00001",
  "name": "Cold City",
  "type": "novel"
}
```

实现说明：

- 如果 `localFingerprint` 已存在，服务端返回已有项目记录。
- 当前没有单独暴露项目详情或项目列表接口。

### `POST /v1/tasks`

请求体：

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

响应体：

```json
{
  "taskId": "20260427214530123_48321",
  "status": "queued"
}
```

与早期设计相比，当前实现里响应体**不包含** `projectId`。

### `GET /v1/tasks/:taskId`

响应体遵循 `taskResultSchema`：

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

实现说明：

- 当前接口只返回任务结果，不返回任务元数据和 `assetIds`。
- 任务列表视图需要通过 `GET /v1/projects/:projectId/tasks` 获取。

### `GET /v1/projects/:projectId/tasks`

响应体：

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
  ]
}
```

实现说明：

- 先查任务列表，再用一次批量查询补齐 `task_asset_refs`。
- 当前还没有分页参数，按 `created_at desc` 返回整个项目的任务列表。

### `GET /v1/projects/:projectId/assets`

响应体：

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
  ]
}
```

实现说明：

- 当前资产索引是轻量占位实现：
  - `assetType = "unknown"`
  - `assetName = assetId`
  - `assetStatus = "active"`
- 索引的目标是支撑任务关联和轻量检索，不承载完整资产正文。

## 数据库存储边界

### 进入 PostgreSQL 的内容

1. 项目元数据：
   - `project_id`
   - `project_name`
   - `project_type`
   - `local_fingerprint`

2. 任务流水：
   - `task_id`
   - `project_id`
   - `target_id`
   - `task_type`
   - `name`
   - `description`
   - `input_text`
   - `status`
   - `output_type`
   - `output_payload`
   - `result_summary`
   - `rationale`
   - `review_hint`
   - `retryable`
   - `error_message`
   - `created_at`
   - `started_at`
   - `finished_at`
   - `updated_at`

3. 任务与资产引用关系：
   - `task_asset_refs`

4. 轻量资产索引：
   - `asset_id`
   - `project_id`
   - `asset_type`
   - `asset_name`
   - `asset_status`
   - `source_task_id`
   - `summary`
   - `version`
   - `updated_at`

### 继续保留在本地明文的内容

- `outline`
- `outline_v2`
- `novel`
- `script`
- `storyboard`
- `video`
- `creative_brief`
- `world_setting`
- `episode_outlines`
- `growth_curve`
- `pacing_curve`
- `emotion_curve`
- `foreshadow_registry`
- 完整 `asset_cards`
- 完整 `relationship_graph`
- 长文本 prompt、上下文 payload 和 AI 原始全文输出

## 数据库结构

### `projects`

- `project_id varchar(5) primary key`
- `project_name varchar(255) not null`
- `project_type varchar(32) not null`
- `local_fingerprint varchar(255) not null unique`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `tasks`

- `task_id varchar(32) primary key`
- `project_id varchar(5) not null references projects(project_id)`
- `target_id varchar(128)`
- `task_type varchar(64) not null`
- `name varchar(255) not null`
- `description text not null`
- `input_text text not null`
- `status varchar(32) not null`
- `output_type varchar(32)`
- `output_payload jsonb`
- `result_summary text`
- `rationale text not null default ''`
- `review_hint text not null default ''`
- `retryable boolean not null default true`
- `error_message text`
- `created_at timestamptz not null default now()`
- `started_at timestamptz`
- `finished_at timestamptz`
- `updated_at timestamptz not null default now()`

索引：

- `(project_id, created_at desc)`
- `(project_id, status, created_at desc)`
- `(project_id, target_id, created_at desc)`

### `task_asset_refs`

- `task_id varchar(32) not null references tasks(task_id) on delete cascade`
- `asset_id varchar(128) not null`
- 主键：`(task_id, asset_id)`
- 索引：`(asset_id)`

### `project_assets`

- `asset_id varchar(128) not null`
- `project_id varchar(5) not null references projects(project_id) on delete cascade`
- `asset_type varchar(32) not null`
- `asset_name varchar(255) not null`
- `asset_status varchar(32) not null`
- `source_task_id varchar(32)`
- `summary text`
- `version integer not null default 1`
- `updated_at timestamptz not null default now()`

主键：

- `(project_id, asset_id)`

索引：

- `(project_id, asset_type, updated_at desc)`
- `(project_id, asset_name)`

这个复合主键是当前实现里一个关键修正，用来避免不同项目下同名资产相互覆盖。

## 读写边界

当前代码已经拆出了以下边界：

- `projectReadRepository`
- `projectWriteRepository`
- `taskReadRepository`
- `taskWriteRepository`

说明：

- 资产索引读写目前仍然由 `postgresTaskRepository` 承担。
- 文档层面不再声称已经存在独立的 `assetReadRepository` / `assetWriteRepository`。
- 如果后续资产能力继续扩展，再单独拆分资产仓储会更自然。

## 查询策略

### 已实现

1. 项目任务列表：
   - 一次查询 `tasks`
   - 一次查询 `task_asset_refs`
   - 在内存中按 `taskId` 分组补齐 `assetIds`

2. 项目资产列表：
   - 直接按 `project_id` 查询 `project_assets`

### 尚未实现

- 列表分页
- 任务详情接口内联返回任务元数据和相关资产引用

文档在这里以当前代码为准，不再把这些能力写成“已经存在”。

## 错误处理

当前代码中明确存在的错误场景：

- `400`：请求体 schema 校验失败
- `404`：项目不存在
- `404`：任务不存在

当前代码中**尚未实现**的行为：

- `task_id` 唯一冲突后的自动重试
- `project_id` 分配冲突后的专门 `409` 处理

## 测试覆盖

当前已有验证包括：

1. 项目注册会返回五位顺序 `projectId`
2. 任务创建由服务端生成 `taskId`
3. `taskId` 格式符合 `17 位时间戳 + 下划线 + 五位随机数`
4. 项目任务列表能返回关联 `assetIds`
5. 项目资产列表能返回轻量索引
6. 同项目资产重复 upsert 时会递增 `version`
7. 桌面端 review flow 已适配新的任务请求结构

## 结论

这套实现已经把“任务流水 + 资产索引入库、项目正文留本地”这个核心方向落地了，但仍然保留了几处明显的后续空间：

1. 任务详情接口如果要承载更完整的界面，需要补任务元数据输出。
2. 项目任务列表和资产列表需要分页。
3. 资产索引目前还是轻量占位值，后续可按资产类型逐步丰富。

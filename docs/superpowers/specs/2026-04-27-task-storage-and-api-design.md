# 任务存储与接口设计

## 目标

定义一套任务流与资产索引的持久化方案，保持项目内容以本地明文为主，同时让服务端能够方便地完成任务创建、任务追踪和资产检索。

本设计有四个核心目标：

1. 请求体简单、可读、接近产品语义。
2. PostgreSQL 只存任务流水和资产索引，不接管完整项目正文。
3. 长文本创作内容、详细创作字段和完整资产详情继续保留在本地明文项目文件中。
4. 服务端结构上提前为读写分离和高效列表查询留出边界，避免后续返工。

## 范围

本设计覆盖：

1. `project_id` 与 `task_id` 的规则。
2. 任务创建请求与响应结构。
3. 哪些字段进 PostgreSQL，哪些字段继续本地存储。
4. 项目表、任务表、任务资产关联表、资产索引表的设计。
5. 读写分离的 repository 边界。
6. 避免 N+1 查询的接口查询策略。
7. 校验、错误处理与测试要求。

本设计不覆盖：

1. 完整云端项目存储。
2. 把完整本地项目文档迁入数据库。
3. 最终编排执行链路的全部内部细节。
4. 前端界面改版。

## 核心决策

### 1. `project_id` 使用五位顺序号

`project_id` 是五位、左侧补零的顺序号，例如：

- `00001`
- `00002`
- `00003`

它在项目创建时生成一次，并在项目生命周期内保持不变。

这样设计的目的是让项目分组、日志排查、数据库人工查看都更直观。

### 2. `task_id` 使用时间戳加五位随机数

`task_id` 由服务端生成，不由客户端传入。

格式：

```text
YYYYMMDDHHmmssSSS_<random5>
```

示例：

- `20260427214530123_48321`
- `20260427214530988_10452`

这样既保留了时间顺序感，又避免客户端承担唯一性生成责任。

### 3. 请求体保持产品语义

客户端不应传内部编排结构，不应把一堆 scope、patch 元信息或完整资产对象塞进请求体。

请求体只表达这些事情：

- 这个任务属于哪个项目
- 这个任务针对哪个目标对象
- 这个任务和哪些资产有关
- 这个任务叫什么
- 这个任务想做什么
- 这个任务实际要处理的输入文本是什么

### 4. 数据库只存任务流水和资产索引

PostgreSQL 存储：

- 项目基础元数据
- 任务元数据与状态流转
- 任务与资产的引用关系
- 轻量资产索引记录

PostgreSQL 不存储：

- 完整本地项目文档
- 大型创作字段 payload
- 完整资产卡正文
- 完整关系图正文
- 长 prompt 正文和原始创作产物全文

## 接口设计

### 创建任务

`POST /v1/tasks`

请求体：

```json
{
  "projectId": "00001",
  "targetId": "act_1",
  "assetIds": ["char_001", "loc_002"],
  "type": "outline.rewrite",
  "name": "重写第一幕冲突",
  "description": "强化主角和对手第一次正面冲突",
  "input": "这里是提交给任务处理的文本内容"
}
```

规则：

1. `projectId` 必填。
2. `targetId` 选填，因为有些任务针对整个项目，而不是某个具体实体。
3. `assetIds` 选填，只传资产 ID，不传完整资产对象。
4. `type` 必填，用于表达任务类型。
5. `name` 必填，用于列表展示和历史追踪。
6. `description` 必填，用于表达这次任务的业务意图。
7. `input` 必填，表示真正投喂给任务处理的输入文本。

响应：

```json
{
  "taskId": "20260427214530123_48321",
  "projectId": "00001",
  "status": "queued"
}
```

### 获取任务详情

`GET /v1/tasks/:taskId`

返回内容包括：

- 任务元数据
- 当前状态
- 结果摘要或错误信息
- 关联的资产 ID 列表

可以返回轻量输出元信息，但不应把它做成完整创作内容的权威来源。

### 获取项目任务列表

`GET /v1/projects/:projectId/tasks`

用途：

- 任务时间线
- 任务历史
- 状态筛选
- 列表页展示

### 获取项目资产列表

`GET /v1/projects/:projectId/assets`

用途：

- 轻量资产检索
- 资产列表展示
- 从任务历史反查资产索引

## 数据库设计

### `projects`

字段：

- `project_id` `varchar(5)` 主键
- `project_name` `varchar(255)` 非空
- `project_type` `varchar(32)` 非空
- `local_fingerprint` `varchar(255)` 非空
- `created_at` `timestamptz` 非空
- `updated_at` `timestamptz` 非空

用途：

- 校验项目是否存在
- 作为任务与资产的稳定归属键

### `tasks`

字段：

- `task_id` `varchar(32)` 主键
- `project_id` `varchar(5)` 非空
- `target_id` `varchar(128)` 可空
- `task_type` `varchar(64)` 非空
- `name` `varchar(255)` 非空
- `description` `text` 非空
- `input_text` `text` 非空
- `status` `varchar(32)` 非空
- `result_summary` `text` 可空
- `error_message` `text` 可空
- `created_at` `timestamptz` 非空
- `started_at` `timestamptz` 可空
- `finished_at` `timestamptz` 可空
- `updated_at` `timestamptz` 非空

索引：

- `project_id, created_at desc`
- `project_id, status, created_at desc`
- `project_id, target_id, created_at desc`

### `task_asset_refs`

字段：

- `task_id` `varchar(32)` 非空
- `asset_id` `varchar(128)` 非空

主键：

- `(task_id, asset_id)`

索引：

- `asset_id`

用途：

- 反向查询
- 补全任务详情
- 统计资产使用情况

### `project_assets`

字段：

- `asset_id` `varchar(128)` 主键
- `project_id` `varchar(5)` 非空
- `asset_type` `varchar(32)` 非空
- `asset_name` `varchar(255)` 非空
- `asset_status` `varchar(32)` 非空
- `source_task_id` `varchar(32)` 可空
- `summary` `text` 可空
- `version` `integer` 非空，默认 `1`
- `updated_at` `timestamptz` 非空

索引：

- `project_id, asset_type, updated_at desc`
- `project_id, asset_name`

用途：

- 轻量资产浏览
- 项目内资产查询
- 从资产追踪来源任务

## 存储边界

### 这些字段进入 PostgreSQL

1. 项目元数据：
   - `project_id`
   - `project_name`
   - `project_type`
   - `local_fingerprint`

2. 任务流水数据：
   - `task_id`
   - `project_id`
   - `target_id`
   - `task_type`
   - `name`
   - `description`
   - `input_text`
   - `status`
   - `result_summary`
   - `error_message`
   - 时间戳字段

3. 资产索引数据：
   - `asset_id`
   - `asset_type`
   - `asset_name`
   - `asset_status`
   - `source_task_id`
   - `summary`
   - `version`

4. 轻量关联数据：
   - 任务与资产引用关系

### 这些内容继续本地明文存储

1. 完整项目文档：
   - `outline`
   - `outline_v2`
   - `detailed_outline`
   - `novel`
   - `script`
   - `storyboard`
   - `video`

2. 创作字段文档：
   - `creative_brief`
   - `world_setting`
   - `episode_outlines`
   - `growth_curve`
   - `pacing_curve`
   - `emotion_curve`
   - `foreshadow_registry`

3. 详细资产内容：
   - 完整 `asset_cards`
   - 完整 `relationship_graph`

4. 长文本处理内容：
   - 原始 prompt 正文
   - 大型上下文 payload
   - 长篇 AI 输出全文

## 读写分离设计

即使第一版仍然使用同一个 PostgreSQL 实例，也应在代码层先把读写边界拆开。

建议的 repository 边界：

- `projectWriteRepository`
- `projectReadRepository`
- `taskWriteRepository`
- `taskReadRepository`
- `assetWriteRepository`
- `assetReadRepository`

写路径职责：

- 创建项目
- 分配下一个顺序 `project_id`
- 创建任务
- 更新任务状态
- 写入任务资产引用
- upsert 资产索引

读路径职责：

- 任务详情
- 任务列表
- 资产列表
- 轻量资产详情

这样以后接入读副本时，不需要重写 service 层逻辑。

## 查询策略与 N+1 避免

服务端不能在循环里逐条查询关联数据。

### 任务列表补全策略

对于任务列表：

1. 一次分页查询取出任务列表。
2. 收集这些任务的 `task_id`。
3. 用一次 `where task_id in (...)` 查询取出对应 `task_asset_refs`。
4. 在内存中按任务分组。
5. 返回补全后的列表项。

禁止这种模式：

1. 先查任务列表。
2. 再对每条任务单独查一次资产关联。

### 任务详情补全策略

对于任务详情：

- 要么使用单次 join 查询，
- 要么使用一次任务查询加一次批量关联查询。

### 资产列表策略

对于项目资产列表：

- 直接按 `project_id` 查询 `project_assets`
- 过滤和分页都在数据库层完成

### 分页要求

任务列表和资产列表接口必须默认分页，不能默认一次性加载无限历史数据。

## 校验与错误处理

### 请求校验

以下情况直接拒绝请求：

1. `projectId` 缺失或格式不合法。
2. `type` 缺失。
3. `name` 为空。
4. `description` 为空。
5. `input` 为空。
6. `assetIds` 中包含非法值。

### 错误场景

- `404`：`projectId` 不存在
- `400`：请求体验证失败
- `409`：顺序 `project_id` 分配冲突且重试失败
- `500`：持久化过程发生未知错误

如果 `task_id` 生成发生冲突，服务端应重新生成新的五位随机尾巴后重试，而不是直接报错。

## 测试策略

最低要求测试包括：

1. 创建任务时由服务端生成 `task_id`。
2. `task_id` 格式符合“时间戳 + 五位随机数”规则。
3. 创建项目时会生成左补零的五位顺序 `project_id`。
4. 任务创建时 `assetIds` 会正确写入 `task_asset_refs`。
5. 项目任务列表能带出关联资产 ID，且不走逐条查询。
6. 资产索引 upsert 会正确更新 `version` 和 `updated_at`。
7. 非法请求体会被 schema 明确拦截。

## 推荐的第一阶段实现顺序

按以下顺序实现：

1. 更新共享 contract，改成简化后的任务请求体结构。
2. 实现服务端 `task_id` 生成。
3. 实现顺序 `project_id` 生成。
4. 建立 `projects`、`tasks`、`task_asset_refs`、`project_assets` 的 PostgreSQL schema。
5. 建立读写分离的 repository 接口和第一版 PostgreSQL 实现。
6. 实现任务创建和任务详情接口。
7. 实现项目任务列表和资产列表接口。
8. 补上 ID 生成、持久化和列表补全的聚焦测试。

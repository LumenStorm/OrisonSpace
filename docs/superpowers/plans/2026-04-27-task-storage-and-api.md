# Task Storage and API Implementation Plan

> 状态说明（2026-04-28）：本文件保留执行前计划，用于回溯实现过程。当前已落地行为请以 [docs/api/server-api.md](/I:/OneLine2Video-dev/OneLine2Video-git/docs/api/server-api.md) 和 [2026-04-27-task-storage-and-api-design.md](/I:/OneLine2Video-dev/OneLine2Video-git/docs/superpowers/specs/2026-04-27-task-storage-and-api-design.md) 为准。
>
> 当前实现和原计划相比，有两处关键更新：
> 1. `project_assets` 已改为 `(project_id, asset_id)` 复合主键，避免跨项目同名资产互相覆盖。
> 2. 桌面端已补充项目注册流程：新建或打开项目时会登记服务端 `projectId`，并写回本地项目元数据后再提交任务。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build sequential `project_id`, server-generated `task_id`, simplified task APIs, PostgreSQL-backed task persistence, and lightweight asset indexing without moving full project content out of local plaintext storage.

**Architecture:** Keep the shared contracts and desktop client request shape simple, then add PostgreSQL-backed project/task persistence behind read/write repository boundaries in the server. Tasks and asset indexes live in the database, while full creative content remains local; list and detail APIs hydrate related asset IDs with batched queries to avoid N+1 lookups.

**Tech Stack:** TypeScript, Fastify, PostgreSQL (`pg`), Zod, Vitest, pnpm workspace

---

## 文件结构

### 计划新增文件

- `apps/server/src/modules/project/routes.ts`
  - 项目注册接口，负责分配五位顺序 `project_id`
- `apps/server/src/modules/project/repositories/projectReadRepository.ts`
  - 项目读 repository 接口
- `apps/server/src/modules/project/repositories/projectWriteRepository.ts`
  - 项目写 repository 接口
- `apps/server/src/modules/project/repositories/postgresProjectRepository.ts`
  - PostgreSQL 项目读写实现
- `apps/server/src/modules/project/service.ts`
  - 项目创建服务，串联顺序 ID 分配和落库
- `apps/server/src/modules/task/repositories/taskReadRepository.ts`
  - 任务读 repository 接口
- `apps/server/src/modules/task/repositories/taskWriteRepository.ts`
  - 任务写 repository 接口
- `apps/server/src/modules/task/repositories/postgresTaskRepository.ts`
  - PostgreSQL 任务与资产索引实现
- `apps/server/src/modules/task/taskId.ts`
  - `task_id` 生成函数
- `apps/server/test/projects.test.ts`
  - 项目接口与顺序 ID 集成测试
- `apps/server/test/taskLists.test.ts`
  - 任务列表、资产列表、批量补全测试

### 计划修改文件

- `packages/shared-contracts/src/contracts/tasks.ts`
  - 简化任务请求体，补充项目创建 schema
- `packages/shared-contracts/src/index.ts`
  - 导出新增 schema
- `packages/shared-contracts/tests/contracts.test.ts`
  - 更新任务 contract 测试，新增项目 contract 测试
- `apps/server/src/common/db.ts`
  - 初始化 `projects`、`tasks`、`task_asset_refs`、`project_assets` 表
- `apps/server/src/app.ts`
  - 注册项目路由
- `apps/server/src/modules/task/routes.ts`
  - 使用新 schema、新服务和新查询接口
- `apps/server/src/modules/task/service.ts`
  - 从内存 mock 流改为持久化任务流
- `apps/server/src/modules/task/mockAdapter.ts`
  - 适配新任务输入结构
- `apps/server/src/modules/task/store.ts`
  - 退役内存任务仓或收缩为测试辅助
- `apps/server/test/tasks.test.ts`
  - 更新为新请求体和服务端生成 `task_id`
- `apps/desktop/local-bff/api/clientApi.ts`
  - 提交新任务请求结构
- `apps/desktop/ui/src/shared/store/types.ts`
  - 更新前端 `TaskRequest` / `TaskAdapter` 类型
- `apps/desktop/ui/src/shared/store/tasksSlice.ts`
  - 用新请求体构造任务
- `apps/desktop/ui/test/reviewFlow.test.tsx`
  - 适配服务端生成 `task_id`

---

### Task 1: 共享 Contract 收敛为简化请求体

**Files:**
- Modify: `packages/shared-contracts/src/contracts/tasks.ts`
- Modify: `packages/shared-contracts/src/index.ts`
- Modify: `packages/shared-contracts/tests/contracts.test.ts`

- [ ] **Step 1: 先写失败的 shared contract 测试**

```ts
it('accepts the simplified task request and project create payload', () => {
  const taskRequest = {
    projectId: '00001',
    targetId: 'act_1',
    assetIds: ['char_001', 'loc_002'],
    type: 'outline.rewrite',
    name: '重写第一幕冲突',
    description: '强化主角和对手第一次正面冲突',
    input: '这里是提交给任务处理的文本内容'
  };

  const projectCreateRequest = {
    name: 'Cold City',
    type: 'novel',
    localFingerprint: 'local_project_cold_city'
  };

  expect(() => taskRequestSchema.parse(taskRequest)).not.toThrow();
  expect(() => projectCreateRequestSchema.parse(projectCreateRequest)).not.toThrow();
});
```

- [ ] **Step 2: 运行单测，确认它因为 schema 还没更新而失败**

Run: `pnpm --filter @orison/shared-contracts test contracts.test.ts`  
Expected: FAIL，提示 `taskId`、`taskType`、`projectFingerprint` 等旧字段仍然是必填，且 `projectCreateRequestSchema` 尚不存在。

- [ ] **Step 3: 用最小变更更新 schema**

```ts
export const taskRequestSchema = z.object({
  projectId: z.string().regex(/^\d{5}$/),
  targetId: z.string().min(1).optional(),
  assetIds: z.array(z.string().min(1)).default([]),
  type: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  input: z.string().min(1)
});

export const projectCreateRequestSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['novel', 'script']),
  localFingerprint: z.string().min(1)
});

export const projectCreateResponseSchema = z.object({
  projectId: z.string().regex(/^\d{5}$/),
  name: z.string().min(1),
  type: z.enum(['novel', 'script'])
});
```

- [ ] **Step 4: 重新运行 shared contract 测试**

Run: `pnpm --filter @orison/shared-contracts test contracts.test.ts`  
Expected: PASS，新的任务请求结构与项目创建结构都能通过 schema 校验。

- [ ] **Step 5: 提交 contract 变更**

```bash
git add packages/shared-contracts/src/contracts/tasks.ts packages/shared-contracts/src/index.ts packages/shared-contracts/tests/contracts.test.ts
git commit -m "feat: simplify task contracts and add project schemas"
```

---

### Task 2: 增加项目注册接口与五位顺序 `project_id`

**Files:**
- Create: `apps/server/src/modules/project/routes.ts`
- Create: `apps/server/src/modules/project/repositories/projectReadRepository.ts`
- Create: `apps/server/src/modules/project/repositories/projectWriteRepository.ts`
- Create: `apps/server/src/modules/project/repositories/postgresProjectRepository.ts`
- Create: `apps/server/src/modules/project/service.ts`
- Modify: `apps/server/src/common/db.ts`
- Modify: `apps/server/src/app.ts`
- Create: `apps/server/test/projects.test.ts`

- [ ] **Step 1: 先写项目注册接口失败测试**

```ts
it('creates a project and returns a zero-padded sequential project id', async () => {
  const app = buildServer();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/projects',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: 'Cold City',
      type: 'novel',
      localFingerprint: 'local_project_cold_city'
    }
  });

  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({
    projectId: expect.stringMatching(/^\d{5}$/),
    name: 'Cold City',
    type: 'novel'
  });
});
```

- [ ] **Step 2: 运行项目接口测试，确认路由不存在时失败**

Run: `pnpm --filter @orison/server test projects.test.ts`  
Expected: FAIL，返回 `404` 或提示 `registerProjectRoutes` 尚未实现。

- [ ] **Step 3: 实现项目表、顺序号分配和注册路由**

```ts
await pool.query(`
  CREATE TABLE IF NOT EXISTS projects (
    project_id        VARCHAR(5) PRIMARY KEY,
    project_name      VARCHAR(255) NOT NULL,
    project_type      VARCHAR(32) NOT NULL,
    local_fingerprint VARCHAR(255) NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

const nextId = String(current + 1).padStart(5, '0');

app.post('/v1/projects', async (request, reply) => {
  const payload = projectCreateRequestSchema.parse(request.body);
  const project = await createProject(payload);
  return reply.code(201).send(project);
});
```

- [ ] **Step 4: 重新运行项目接口测试**

Run: `pnpm --filter @orison/server test projects.test.ts`  
Expected: PASS，接口能返回五位顺序 `project_id`，重复 `localFingerprint` 可按实现返回已有记录或冲突错误。

- [ ] **Step 5: 提交项目注册功能**

```bash
git add apps/server/src/common/db.ts apps/server/src/app.ts apps/server/src/modules/project apps/server/test/projects.test.ts
git commit -m "feat: add project registration and sequential ids"
```

---

### Task 3: 任务持久化与服务端生成 `task_id`

**Files:**
- Create: `apps/server/src/modules/task/taskId.ts`
- Create: `apps/server/src/modules/task/repositories/taskReadRepository.ts`
- Create: `apps/server/src/modules/task/repositories/taskWriteRepository.ts`
- Create: `apps/server/src/modules/task/repositories/postgresTaskRepository.ts`
- Modify: `apps/server/src/common/db.ts`
- Modify: `apps/server/src/modules/task/service.ts`
- Modify: `apps/server/src/modules/task/routes.ts`
- Modify: `apps/server/test/tasks.test.ts`

- [ ] **Step 1: 先写失败的任务创建测试，断言服务端生成 `task_id`**

```ts
it('creates a task and returns a server-generated task id', async () => {
  const app = buildServer();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/tasks',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      projectId: projectId,
      targetId: 'act_1',
      assetIds: ['char_001'],
      type: 'outline.rewrite',
      name: '重写第一幕冲突',
      description: '强化主角和对手第一次正面冲突',
      input: '让冲突更紧张'
    }
  });

  expect(response.statusCode).toBe(202);
  expect(response.json().taskId).toMatch(/^\d{17}_\d{5}$/);
});
```

- [ ] **Step 2: 运行任务接口测试，确认旧路由仍依赖客户端传 `taskId` 而失败**

Run: `pnpm --filter @orison/server test tasks.test.ts`  
Expected: FAIL，旧实现会尝试读取 `payload.taskId`，并且 schema 与当前请求体不匹配。

- [ ] **Step 3: 实现 `tasks`、`task_asset_refs` 表和任务写服务**

```ts
await pool.query(`
  CREATE TABLE IF NOT EXISTS tasks (
    task_id         VARCHAR(32) PRIMARY KEY,
    project_id      VARCHAR(5) NOT NULL REFERENCES projects(project_id),
    target_id       VARCHAR(128),
    task_type       VARCHAR(64) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL,
    input_text      TEXT NOT NULL,
    status          VARCHAR(32) NOT NULL,
    result_summary  TEXT,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

export function createTaskId(now = new Date(), random = Math.floor(Math.random() * 100000)) {
  const stamp = now.toISOString().replace(/\D/g, '').slice(0, 17);
  return `${stamp}_${String(random).padStart(5, '0')}`;
}
```

- [ ] **Step 4: 重新运行任务接口测试**

Run: `pnpm --filter @orison/server test tasks.test.ts`  
Expected: PASS，接口接受新请求体并返回服务端生成的 `task_id`，任务记录落入 PostgreSQL。

- [ ] **Step 5: 提交任务持久化基础**

```bash
git add apps/server/src/common/db.ts apps/server/src/modules/task apps/server/test/tasks.test.ts
git commit -m "feat: persist tasks and generate server task ids"
```

---

### Task 4: 任务详情、任务列表、资产列表与批量补全

**Files:**
- Modify: `apps/server/src/modules/task/routes.ts`
- Modify: `apps/server/src/modules/task/service.ts`
- Modify: `apps/server/src/modules/task/repositories/postgresTaskRepository.ts`
- Create: `apps/server/test/taskLists.test.ts`

- [ ] **Step 1: 先写失败的列表与详情测试**

```ts
it('lists project tasks with related asset ids using batched hydration', async () => {
  const app = buildServer();
  const response = await app.inject({
    method: 'GET',
    url: `/v1/projects/${projectId}/tasks`,
    headers: { authorization: `Bearer ${token}` }
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().items[0]).toMatchObject({
    projectId,
    assetIds: expect.any(Array)
  });
});

it('lists project assets from the asset index table', async () => {
  const app = buildServer();
  const response = await app.inject({
    method: 'GET',
    url: `/v1/projects/${projectId}/assets`,
    headers: { authorization: `Bearer ${token}` }
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    items: expect.any(Array)
  });
});
```

- [ ] **Step 2: 运行列表测试，确认接口未实现而失败**

Run: `pnpm --filter @orison/server test taskLists.test.ts`  
Expected: FAIL，`/v1/projects/:projectId/tasks` 与 `/v1/projects/:projectId/assets` 尚不存在。

- [ ] **Step 3: 实现批量补全查询与列表路由**

```ts
const tasks = await taskReadRepository.listByProject(projectId, { limit, cursor });
const refs = await taskReadRepository.listAssetRefsForTaskIds(tasks.map((task) => task.taskId));

const grouped = new Map<string, string[]>();
for (const ref of refs) {
  const current = grouped.get(ref.taskId) ?? [];
  current.push(ref.assetId);
  grouped.set(ref.taskId, current);
}

return tasks.map((task) => ({
  ...task,
  assetIds: grouped.get(task.taskId) ?? []
}));
```

- [ ] **Step 4: 重新运行列表测试**

Run: `pnpm --filter @orison/server test taskLists.test.ts`  
Expected: PASS，任务列表和资产列表都可返回，且实现采用一次任务查询 + 一次批量资产关联查询。

- [ ] **Step 5: 提交列表与补全逻辑**

```bash
git add apps/server/src/modules/task/routes.ts apps/server/src/modules/task/service.ts apps/server/src/modules/task/repositories/postgresTaskRepository.ts apps/server/test/taskLists.test.ts
git commit -m "feat: add project task and asset list endpoints"
```

---

### Task 5: 资产索引 upsert 与任务完成结果落库

**Files:**
- Modify: `apps/server/src/common/db.ts`
- Modify: `apps/server/src/modules/task/mockAdapter.ts`
- Modify: `apps/server/src/modules/task/service.ts`
- Modify: `apps/server/src/modules/task/repositories/postgresTaskRepository.ts`
- Modify: `apps/server/test/taskLists.test.ts`

- [ ] **Step 1: 先写失败测试，覆盖任务完成后资产索引更新**

```ts
it('upserts project asset index rows when a task completes with related assets', async () => {
  const app = buildServer();
  await app.inject({
    method: 'POST',
    url: '/v1/tasks',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      projectId,
      targetId: 'act_1',
      assetIds: ['char_001'],
      type: 'outline.rewrite',
      name: '更新角色冲突',
      description: '推动角色关系升级',
      input: '让角色冲突更直接'
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 20));

  const rows = await query('SELECT asset_id, version FROM project_assets WHERE project_id = $1', [projectId]);
  expect(rows.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ asset_id: 'char_001' })
    ])
  );
});
```

- [ ] **Step 2: 运行测试，确认 `project_assets` 还未被写入时失败**

Run: `pnpm --filter @orison/server test taskLists.test.ts`  
Expected: FAIL，`project_assets` 表为空或还不存在。

- [ ] **Step 3: 最小实现资产索引表与 upsert**

```ts
await pool.query(`
  CREATE TABLE IF NOT EXISTS project_assets (
    asset_id        VARCHAR(128) PRIMARY KEY,
    project_id      VARCHAR(5) NOT NULL REFERENCES projects(project_id),
    asset_type      VARCHAR(32) NOT NULL,
    asset_name      VARCHAR(255) NOT NULL,
    asset_status    VARCHAR(32) NOT NULL,
    source_task_id  VARCHAR(32),
    summary         TEXT,
    version         INTEGER NOT NULL DEFAULT 1,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

await query(
  `INSERT INTO project_assets (asset_id, project_id, asset_type, asset_name, asset_status, source_task_id, summary)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   ON CONFLICT (asset_id) DO UPDATE
   SET version = project_assets.version + 1,
       asset_status = EXCLUDED.asset_status,
       source_task_id = EXCLUDED.source_task_id,
       summary = EXCLUDED.summary,
       updated_at = NOW()`,
  [assetId, projectId, 'unknown', assetId, 'active', taskId, description]
);
```

- [ ] **Step 4: 重新运行任务完成后的资产索引测试**

Run: `pnpm --filter @orison/server test taskLists.test.ts`  
Expected: PASS，任务完成后对应资产索引能被写入或更新。

- [ ] **Step 5: 提交资产索引落库**

```bash
git add apps/server/src/common/db.ts apps/server/src/modules/task/mockAdapter.ts apps/server/src/modules/task/service.ts apps/server/src/modules/task/repositories/postgresTaskRepository.ts apps/server/test/taskLists.test.ts
git commit -m "feat: upsert project asset indexes from task flow"
```

---

### Task 6: 桌面端请求适配与回归测试

**Files:**
- Modify: `apps/desktop/local-bff/api/clientApi.ts`
- Modify: `apps/desktop/ui/src/shared/store/types.ts`
- Modify: `apps/desktop/ui/src/shared/store/tasksSlice.ts`
- Modify: `apps/desktop/ui/test/reviewFlow.test.tsx`

- [ ] **Step 1: 先写失败的前端测试适配点**

```ts
const mockAdapter: TaskAdapter = {
  async submitTask() {
    return { taskId: '20260427214530123_48321', status: 'queued' };
  },
  async getTaskResult(taskId) {
    return {
      taskId,
      status: 'completed',
      outputType: 'patch',
      outputPayload: {
        operations: [{ op: 'replace', path: 'story.acts[0].summary', value: 'Rewritten: Make the opening darker.' }]
      },
      summary: 'Mock rewrite completed.',
      rationale: 'The mock adapter echoes the requested direction.',
      reviewHint: 'Confirm the patch targets the intended act.',
      retryable: true
    };
  }
};
```

- [ ] **Step 2: 运行桌面端测试，确认旧请求结构与 `request.taskId` 访问会失败**

Run: `pnpm --filter @orison/desktop-ui test reviewFlow.test.tsx`  
Expected: FAIL，`submitTask` mock 或 `tasksSlice` 仍依赖旧 `taskId` 请求字段。

- [ ] **Step 3: 更新前端请求结构与状态管理**

```ts
const request: TaskRequest = {
  projectId: '00001',
  targetId: 'act_1',
  assetIds: [],
  type: 'outline.rewrite',
  name: '重写当前段落',
  description: instruction,
  input: instruction
};

const { taskId } = await adapter.submitTask(request);
set({ currentTask: { request, result: null } });
```

- [ ] **Step 4: 重新运行桌面端测试**

Run: `pnpm --filter @orison/desktop-ui test reviewFlow.test.tsx`  
Expected: PASS，前端不再自己构造 `taskId`，而是接收服务端返回值继续轮询。

- [ ] **Step 5: 提交桌面端适配**

```bash
git add apps/desktop/local-bff/api/clientApi.ts apps/desktop/ui/src/shared/store/types.ts apps/desktop/ui/src/shared/store/tasksSlice.ts apps/desktop/ui/test/reviewFlow.test.tsx
git commit -m "feat: align desktop task client with simplified api"
```

---

### Task 7: 全链路验证与收尾

**Files:**
- Verify only: `packages/shared-contracts/tests/contracts.test.ts`
- Verify only: `apps/server/test/projects.test.ts`
- Verify only: `apps/server/test/tasks.test.ts`
- Verify only: `apps/server/test/taskLists.test.ts`
- Verify only: `apps/desktop/ui/test/reviewFlow.test.tsx`

- [ ] **Step 1: 运行 shared-contracts 测试**

Run: `pnpm --filter @orison/shared-contracts test contracts.test.ts`  
Expected: PASS

- [ ] **Step 2: 运行服务端任务与项目测试**

Run: `pnpm --filter @orison/server test projects.test.ts tasks.test.ts taskLists.test.ts`  
Expected: PASS

- [ ] **Step 3: 运行桌面端回归测试**

Run: `pnpm --filter @orison/desktop-ui test reviewFlow.test.tsx`  
Expected: PASS

- [ ] **Step 4: 运行服务端类型检查**

Run: `pnpm --filter @orison/server typecheck`  
Expected: PASS

- [ ] **Step 5: 提交验证通过后的收尾提交**

```bash
git add apps/server packages/shared-contracts apps/desktop
git commit -m "feat: add task storage and project indexing flow"
```

---

## 计划自检

### Spec 覆盖检查

本计划覆盖了 spec 中的所有关键要求：

1. `project_id` 五位顺序号：Task 2
2. `task_id` 时间戳加五位随机：Task 3
3. 简化请求体：Task 1、Task 6
4. 任务流水与资产索引入库：Task 3、Task 5
5. 本地明文继续保留：通过只落轻量索引、不迁移完整项目内容来满足，Task 5 明确只写 `project_assets`
6. 读写分离：Task 2、Task 3 通过 read/write repository 边界落实
7. 避免 N+1：Task 4 通过批量补全查询落实

额外新增的 `POST /v1/projects` 不属于偏离范围，而是落实顺序 `project_id` 分配与项目存在校验所必需的支撑接口。

### 占位检查

本计划未使用 `TBD`、`TODO`、`后续补充`、`适当处理` 这类占位语句。每个实现步骤都给出了具体文件、测试命令和最小代码方向。

### 类型一致性检查

计划中统一使用：

- `projectId`
- `taskId`
- `targetId`
- `assetIds`
- `type`
- `name`
- `description`
- `input`

数据库字段统一映射为：

- `project_id`
- `task_id`
- `target_id`
- `task_type`
- `input_text`

没有在后续任务中引入未定义的新请求字段名。

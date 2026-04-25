# Phase 1 实施计划：Contract Foundation

## 概述

基于 `2026-04-25-agent-entry-and-creative-fields-design.md` 设计文档，落地 Phase 1 最小可用闭环。所有改动保持向后兼容，旧字段不删除，现有测试不破坏。

## 改动范围

### 文件 1：`packages/shared-contracts/src/contracts/creative-fields.ts`（新建）

创作字段 schema，包含设计文档中定义的 8 个核心字段：

- `worldSettingSchema` — 世设
- `outlineSchemaV2` — 总大纲（扩展现有 outline，增加 central_conflict、major_turning_points、ending_direction）
- `episodeOutlineSchema` / `episodeOutlinesSchema` — 集纲
- `growthCurveSchema` — 成长曲线
- `pacingCurveSchema` — 节奏曲线
- `emotionCurveSchema` — 情感曲线
- `assetCardSchema` / `assetCardsSchema` — 资产卡
- `relationshipGraphSchema` — 人物关系网
- `fieldMetadataSchema` — 字段元信息（version, source, locked, dependsOn, stale, lastSyncedAt）
- `CreativeFieldKey` 联合类型
- `creativeBriefSchema` — 创作 brief

### 文件 2：`packages/shared-contracts/src/contracts/agent-contract.ts`（新建）

Agent 入口契约和子 agent 契约：

- `creativeConstraintsSchema` — 语言、分级、集数、篇幅约束
- `agentPolicySchema` — 全局 agent 行为约束
- `agentContractSchema` — 子 agent 结构化契约（id, role, goal, owns, reads, must, mustNot, outputSchemaName, qualityGates）
- `creativeRunRequestSchema` — 入口请求（替代 startOrchestrationRunSchema 的扩展）
- `creativeRunContextSchema` — 归一化上下文
- `workflowSyncEventSchema` — 同步事件
- `fieldDependencyGraphSchema` — 字段依赖图
- `assetPatchCandidateSchema` — 资产候选补丁

### 文件 3：`packages/shared-contracts/src/index.ts`（修改）

新增两行 export：
```ts
export * from './contracts/creative-fields';
export * from './contracts/agent-contract';
```

### 文件 4：`apps/agent/src/engine/agentContracts.ts`（新建）

所有子 agent 的结构化契约注册表，包含 8 个 agent 的 `AgentContract`：

- intake-agent
- asset-loader-agent
- story-planner-agent
- curve-planner-agent（新增节点）
- episode-planner-agent（新增节点，替代 chapter-task-agent 的职责）
- draft-writer-agent
- continuity-memory-agent
- multi-review-agent
- targeted-revision-agent

提供 `getAgentContract(id)` 和 `getAllAgentContracts()` 函数。

### 文件 5：`apps/agent/src/engine/registry.ts`（修改）

- 每个 `PythonRegistryNode` 增加可选 `contract` 字段，引用 `AgentContract`。
- `createNodeRegistry()` 中为每个节点关联对应 contract。
- 新增 `curve-planner-agent` 和 `episode-planner-agent` 节点。
- `chapter-task-agent` 保留但标记为 deprecated。

### 文件 6：`apps/agent/src/engine/contextBuilder.ts`（新建）

入口上下文构建器：

- `buildCreativeRunContext(request, projectDocument?)` — 将 `CreativeRunRequest` 归一化为 `CreativeRunContext`。
- 初始化 `fieldVersions`（从 projectDocument 或默认 0）。
- 构建 `dependencyGraph`（硬编码依赖关系）。
- 计算 `staleFields`。
- 填充默认 `agentPolicy`。

### 文件 7：`apps/agent/src/engine/workflowSync.ts`（新建）

字段版本和同步事件服务：

- `FieldDependencyGraph` — 硬编码依赖关系常量。
- `computeAffectedFields(changedField)` — 根据依赖图计算受影响下游字段。
- `createSyncEvent(params)` — 创建 WorkflowSyncEvent。
- `markStaleFields(fieldVersions, changedField)` — 标记 stale 字段。

### 文件 8：`apps/agent/src/engine/assetLibrary.ts`（新建）

资产候选补丁服务：

- `extractAssetCandidates(artifact, existingCards)` — 从 artifact 中提取资产候选。
- `classifyPatch(candidate, existingCards)` — 分类为 auto-apply 或 needs-review。
- `AssetPatchCandidate` 类型已在 shared-contracts 中定义。

### 文件 9：`apps/agent/src/engine/artifactYaml.ts`（新建）

YAML artifact 读写：

- `writeArtifactYaml(runId, fieldKey, artifact, meta)` — 写入 `project-config/runs/<runId>/artifacts/<fieldKey>.yaml`，带 schema_version、field_version、generated_by、source_refs。
- `readArtifactYaml(runId, fieldKey)` — 读取并校验。
- `buildContextPacket(nodeContract, artifacts, fieldVersions)` — 构建瘦身上下文包。

### 文件 10：`apps/agent/src/engine/runService.ts`（修改）

- `start()` 方法增加对 `CreativeRunRequest` 的支持：检测是否有新字段，若有则调用 `buildCreativeRunContext()`。
- 保持对旧 `StartRunCommand` 的兼容。
- run 完成后，调用 `workflowSync` 生成 syncEvents。
- delivery 阶段调用 `artifactYaml.writeArtifactYaml()` 落盘。

### 文件 11：`apps/agent/src/routes.ts`（修改）

- `POST /v1/orchestration/runs` 同时接受旧 `startOrchestrationRunSchema` 和新 `creativeRunRequestSchema`，内部判断后走不同路径。

### 文件 12：`apps/agent/src/contracts/run.ts`（修改）

- 新增 `CreativeRunContext` 类型导出。
- `NodeRunInput` 增加可选 `context?: CreativeRunContext` 字段。

---

## 测试文件

### 文件 T1：`packages/shared-contracts/tests/creative-fields.test.ts`（新建）

- 每个创作字段 schema 能 parse 完整示例。
- `CreativeFieldKey` 覆盖所有 8 个字段。
- `fieldMetadataSchema` 校验。

### 文件 T2：`packages/shared-contracts/tests/agent-contract.test.ts`（新建）

- `CreativeRunRequest` 和 `CreativeRunContext` schema parse。
- `AgentContract` schema parse。
- `WorkflowSyncEvent` schema parse。

### 文件 T3：`apps/agent/test/agentContracts.test.ts`（新建）

- 每个注册节点都有 AgentContract。
- 每个 contract 的 `owns` 与 registry 中 `stateKey` 匹配。
- `reads` 和 `owns` 不重叠。

### 文件 T4：`apps/agent/test/contextBuilder.test.ts`（新建）

- `buildCreativeRunContext` 从最小 request 构建完整 context。
- `fieldVersions` 初始化正确。
- `dependencyGraph` 包含所有核心字段。

### 文件 T5：`apps/agent/test/workflowSync.test.ts`（新建）

- `computeAffectedFields('asset_cards')` 返回正确下游字段。
- `createSyncEvent` 生成合法事件。
- `markStaleFields` 标记正确。

### 文件 T6：`apps/agent/test/artifactYaml.test.ts`（新建）

- artifact 写入 YAML 后再读取，schema 校验结果不变。
- context packet 只包含目标节点 `reads` 中声明的字段。

---

## 实施顺序

1. `creative-fields.ts` + `agent-contract.ts` + `index.ts` 导出 → 运行 shared-contracts 测试
2. `agentContracts.ts` 注册表 → 运行 agent contracts 测试
3. `contextBuilder.ts` + `workflowSync.ts` → 运行对应测试
4. `assetLibrary.ts` + `artifactYaml.ts` → 运行对应测试
5. 修改 `registry.ts`、`run.ts`、`runService.ts`、`routes.ts` → 运行全量测试
6. 确认所有现有测试仍通过

## 不做的事

- 不改前端 UI
- 不重写数据库持久化
- 不删除旧字段（outline、detailed_outline、assets）
- 不新增 `/v1/agent/runs` 路由（复用现有路由）
- 不实现完整 Prompt YAML loader 与 AgentContract 一致性校验（第一阶段先建立结构，校验在后续迭代加入）

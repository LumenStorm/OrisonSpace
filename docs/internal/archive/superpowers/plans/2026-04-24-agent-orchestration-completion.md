# Agent 编排功能补全计划

## 背景

架构图 v2 定义了完整的 agent 编排流水线，分为三层：

```
规划层:  需求接入 → 资产装载 → 故事规划 → 章节任务卡 → 正文初稿生成 → 连续性记忆更新
生产层:  → 多维审核 → 是否通过? ──通过──→ 版本归档 → 交付输出 → 数据回流
                          │                                    │ (虚线)
                        未通过                          更新资产与规则 → 资产装载
                          ↓                          影响后续生成与审核 → 多维审核
                       定向修订 → 多维审核 (循环)
         重大冲突 → 人工接管 → 多维审核
```

worktree 分支 `feat-multi-agent-orchestration-v1` 已实现：
- 8 个 agent 节点（TS + Python 双端）
- runService 顺序执行引擎
- reviewRouter 审核路由
- orchestration routes（start/get）
- orchestrationStore + OrchestrationPanel 骨架
- archiveRepository 骨架

## 缺失功能（按架构图对照）

1. **版本归档** — 服务端归档逻辑未接入 runService
2. **交付输出** — 完全缺失
3. **数据回流** — 完全缺失
4. **actions 端点** — 返回 501，accept/edit/rerun/abort 未实现
5. **OrchestrationPanel** — 只有启动按钮，缺少节点进度、审核交互、归档展示
6. **orchestrationStore** — 硬编码 mock 数据，未对接真实 API

## 实施步骤

### 第 1 步：shared-contracts 补充 schema

文件：`packages/shared-contracts/src/orchestration.ts`

- 新增 `deliveryOutputSchema`：定义交付输出结构（格式、内容引用、元数据）
- 新增 `dataFeedbackSchema`：定义数据回流结构（规则更新、资产补丁）
- 扩展 `orchestrationRunSchema`：添加 `delivery` 和 `feedback` 可选字段

### 第 2 步：服务端 — 版本归档节点

文件：`apps/server/src/modules/orchestration/engine/archiveService.ts`（新建）

- `createArchiveRecord(run)` → 生成 versionId、记录 archivedAt、收集 promptFiles
- 在 runService 中，当 status=approved 后调用归档，将 run.archive 填充

### 第 3 步：服务端 — 交付输出节点

文件：`apps/server/src/modules/orchestration/engine/deliveryService.ts`（新建）

- `buildDeliveryOutput(run)` → 从 artifacts 中提取最终产物，组装交付包
- 交付包含：draft 文本、story plan、review summary
- 归档完成后自动触发交付，run.status 变为 `delivered`

### 第 4 步：服务端 — 数据回流节点

文件：`apps/server/src/modules/orchestration/engine/feedbackService.ts`（新建）

- `buildFeedback(run)` → 从 review + artifacts 中提取可回流的规则/资产更新
- 产出 feedback 记录，附加到 run.feedback
- 虚线关系：feedback 不阻塞当前 run，但记录供下次 run 的资产装载和审核参考

### 第 5 步：服务端 — actions 端点实现

文件：`apps/server/src/modules/orchestration/routes.ts`（修改）
文件：`apps/server/src/modules/orchestration/engine/actionService.ts`（新建）

实现 4 个 action：
- `accept_current` → 将当前 human_in_loop 的 run 标记为 approved，触发归档→交付→回流
- `edit_and_resume` → 接受 payload 中的修改，更新 artifacts，从当前节点继续执行
- `rerun_from_node` → 从指定 nodeId 重新执行后续链路
- `abort_run` → 将 run 标记为 failed，记录原因

### 第 6 步：runService 集成归档→交付→回流

文件：`apps/server/src/modules/orchestration/engine/runService.ts`（修改）

在 run 完成（status=approved）后，顺序执行：
1. archiveService.createArchiveRecord(run)
2. deliveryService.buildDeliveryOutput(run)
3. feedbackService.buildFeedback(run)
4. 最终 status 变为 `delivered`

### 第 7 步：客户端 — orchestrationStore 对接真实 API

文件：`apps/desktop/ui/src/shared/store/orchestrationStore.ts`（修改）

- `startRun()` → 调用 `POST /v1/orchestration/runs`
- `refreshRun()` → 调用 `GET /v1/orchestration/runs/:runId`
- `performAction(action)` → 调用 `POST /v1/orchestration/actions`
- 新增 `delivery` 和 `feedback` 状态字段

### 第 8 步：客户端 — OrchestrationPanel 完善

文件：`apps/desktop/ui/src/features/orchestration/OrchestrationPanel.tsx`（修改）

- 节点进度列表：显示 completedNodes / pendingNodes / currentNodeId
- 审核交互区：当 status=human_in_loop 时显示 accept/edit/abort 按钮
- 归档展示：当 status=delivered 时显示 delivery 内容和 feedback 摘要
- loading/error 状态处理

### 第 9 步：测试

- 服务端：archiveService / deliveryService / feedbackService / actionService 单元测试
- 服务端：runService 集成测试（完整链路 → delivered）
- 客户端：OrchestrationPanel 交互测试（进度展示、action 按钮）
- Python：无需改动（现有 node 实现不受影响）

## 工作目录

所有修改在 worktree 分支 `feat-multi-agent-orchestration-v1` 中进行。

## 不做的事

- 不改动现有 8 个 agent 节点的逻辑
- 不改动 Python 端代码
- 不引入新依赖
- 不改动认证/任务等无关模块

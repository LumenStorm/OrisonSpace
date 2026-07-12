# 数据流稳定化设计

## 目标

消除保存竞态、保存失败误报、跨项目异步回写、Agent 权限与取消状态分裂，以及 `project.yaml` 多写入者问题，使所有持久化结果都能回答两个问题：写入了哪个快照，以及结果属于哪个项目/运行。

## 核心设计

### 保存确认

- `saveFile` 在发起写入时捕获 tab id、路径和内容快照。
- 写入成功后只把该快照记为 `savedContent`；若等待期间内容继续变化，tab 必须保持 dirty。
- `saveAllOpenFiles` 的 `{ failed }` 是统一失败契约。手动保存、自动保存、刷新字数、批量关闭和关闭项目都必须消费该结果。
- 保存失败时不得继续发布“已保存”、刷新基于磁盘的数据或清空项目状态。

### 项目作用域

- 所有项目相关异步请求捕获 project id/path 和单调 epoch/token。
- await 后只有 scope 与 token 都仍匹配时才能回写当前 Store。
- 后台任务可继续为原项目执行和持久化，但不得污染当前项目；重新打开原项目时从持久层恢复。
- 项目 reset 清除所有项目级 UI 快照，并使旧 token 失效。

### Agent 会话、权限和取消

- 创建、加载、切换会话以及流事件都校验项目 epoch。
- 权限模式成为 session 级持久化属性；已有 session 的模式切换必须通过 runtime IPC 成功后再成为 UI 真相。
- AbortSignal 从 runtime 贯穿 Shell 模型网关和工具处理器；模型返回后、持久化 assistant 前再次检查取消。
- 每次运行使用身份令牌，旧运行结束不得覆盖新运行状态。

### project.yaml 所有权

- `project.yaml` 是受管配置，只允许结构化项目 IPC 在项目锁内写入。
- 通用文件写入、重命名、删除和 Agent `write_file` 拒绝操作该文件；编辑器以只读方式展示。
- 章节同步返回明确的 mutation result，renderer 必须等待并处理失败。
- 外部有效变更触发统一重新水合；解析失败保留当前内存状态并展示错误。

## 测试策略

- 使用 deferred promise 稳定复现保存、项目切换和 session 切换竞态。
- 分别覆盖 UI Store、Shell IPC 和 Agent runtime 边界。
- 专项测试通过后执行 `pnpm test`、`pnpm typecheck` 和 `pnpm lint`。

## 约束

- 不执行 commit、push、pull、merge、rebase 或 reset。
- 不修改现有未跟踪的 `PLAN-2026-07-07.md` 与 `REVIEW-2026-07-07.md`。

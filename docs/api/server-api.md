# 服务端 API 参考

> **已废弃**：服务端（`apps/server`）已在 2026-05 移除。当前架构为纯本地桌面应用，无独立服务端进程。

原服务端职责已迁移至：

- **鉴权**：已移除，桌面端为纯本地应用，无需登录
- **Orchestration 代理**：Agent 已作为库内嵌于桌面主进程（`@orison/desktop-agent`），通过 IPC 直接调用
- **模型生成**：桌面主进程通过 `@orison/model-protocols` 直连第三方模型

相关文档：

- [桌面 IPC 参考](../ipc/desktop-ipc.md)
- [Agent 文档](../agent.md)
- [模块边界规则](../architecture/module-boundaries.md)

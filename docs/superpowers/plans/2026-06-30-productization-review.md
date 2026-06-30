# Orison Space 产品化 Review

> **For agentic workers:** 本文是产品化静态 review 记录，不是实现计划。后续执行前，应先阅读配套 TODO 文档 `2026-06-30-productization-todo.md`，并按其中的需求对齐问题确认范围。本文不声明测试已通过。

**Goal:** 评估当前仓库是否已经具备发展为完整产品的基础，并指出会影响用户信任、产品承诺、发布稳定性和长期工程治理的主要风险。

**Review Scope:** 顶层 README / CHANGELOG / SECURITY / CONTRIBUTING、`docs/` 架构文档、`apps/desktop/*` 与 `packages/*` 结构、CI/release 配置、IPC/Agent/Orchestration 相关静态代码。未运行测试，未验证真实桌面应用交互。

**Product Assumption:** Orison Space 目标形态是一个开源、本地优先、可安装、可更新、可恢复、可长期维护的 AI 长篇创作 IDE，而不是一次性 demo 或内部实验工具。

---

## Executive Summary

项目已经具备产品雏形：monorepo 边界清晰，Electron shell、React UI、local-bff、agent runtime、shared contracts、model protocols、story-sync 分层明确；测试覆盖也不是空壳，已经包含 IPC、安全边界、local-bff、agent runtime、UI 组件和 contracts。

当前最大的产品化风险不是“没有功能”，而是“承诺、实现、文档、发布叙事没有完全对齐”。README 展示的完整产品能力、文档里承认的未完成项、代码中的内存 stub、版本/License/安全策略之间存在错位。下一阶段应优先收敛可信 Alpha，而不是继续扩大功能面。

---

## Findings

### 1. Orchestration / Auto Mode 仍是产品承诺和实现之间的最大缺口

**Severity:** High

**Evidence:**
- `README.en.md` 将 Agent orchestration 描述为核心亮点：Skills / Workflows / nested sub-agents，LLM 自动调用工具。
- `docs/architecture/module-boundaries.md` 明确写 Auto Mode 执行引擎已移除、待重建。
- `apps/desktop/client/shell/main/ipc/orchestrationIpc.ts` 当前使用进程内 `Map` 保存 `runs` / `autoModes`，`start-run` 只创建 pending run，`auto-mode-start` 只创建 planning state，action 只改变状态。
- 当前状态不会跨重启恢复，也没有真实 workflow 执行、任务队列、失败重试、取消传播或产物落盘。

**Risk:** 用户会把 Auto Mode / Orchestration 理解为完整可用能力，但实际行为更像占位接口。作为产品发布时，这会造成体验落差，也会让后续 bug 报告难以界定是缺陷还是未完成。

**Recommendation:** 产品化前二选一：
- 降级承诺：README、UI、文档统一标记为实验性或待重建，不作为核心卖点。
- 补齐实现：做真实执行引擎、持久化、恢复、取消、失败重试和端到端测试。

### 2. 版本、License、发布状态叙事不一致

**Severity:** High

**Evidence:**
- 根 `package.json` 和 desktop shell 是 `0.3.0`。
- `CHANGELOG.md` 只记录到 `0.2.0`。
- `SECURITY.md` 写 `0.1.x (latest)`。
- `README.en.md` 宣称 Apache-2.0/open-source。
- `docs/internal/development-status.md` 仍写 `License: Private`。

**Risk:** 版本支持、开源许可、发布状态是用户和贡献者建立信任的入口。这里不一致会影响下载、贡献、漏洞报告和后续 release note 管理。

**Recommendation:** 在进入下一轮功能开发前，先做一次“项目信任面”清理：统一版本、License、支持策略、Alpha 边界和 changelog。

### 3. 面向用户和贡献者的文档存在编码损坏与缺失素材

**Severity:** High

**Evidence:**
- README、CHANGELOG、CONTRIBUTING、SECURITY、CI 注释和部分配置注释存在明显 mojibake，例如破折号、中文、emoji、部分链接标题损坏。
- `README.en.md` 保留 `TODO: Add screenshot`。

**Risk:** 这会直接影响开源首页观感、搜索收录、贡献者上手和用户下载信任。对于一个创作类产品，第一印象尤其重要。

**Recommendation:** 将文档编码修复列为 P0。所有 Markdown 和配置注释按 UTF-8 重写或校验，并补一张能展示真实 workspace 的截图或短 GIF。

### 4. 质量门禁已经有基础，但仍处于宽松 Alpha 阶段

**Severity:** Medium

**Evidence:**
- CI 会跑 `pnpm typecheck`、`pnpm lint`、`pnpm test`，并覆盖 Ubuntu / Windows / macOS。
- 根 lint 包含 ESLint 和 dependency-cruiser。
- 多个 workspace 的 `lint` 脚本仍是 placeholder。
- `docs/internal/lint-baseline.md` 记录 ESLint warning 基线 252，dependency-cruiser warning 基线 13。
- ESLint 中 features/store 直连 `window.orisonDesktop`、裸 HTTP、i18n 裸文本等仍是 warn，不阻断 CI。

**Risk:** 对 Alpha 可接受，但离完整产品还有差距。尤其 IPC 边界和 renderer 访问 preload 的收口，如果长期停留 warn，会让架构文档与真实约束逐渐漂移。

**Recommendation:** 按风险分阶段升级门禁：安全红线保持 error；IPC/data-flow 边界清零后升 error；i18n 和通用代码质量再逐步收敛。

### 5. Agent 子代理能力边界还没有完全闭合

**Severity:** Medium

**Evidence:**
- `docs/agent.md` 说明子代理 frontmatter 的 `model` / `tools` 字段目前只解析，未实际接入 model gateway 路由或 tool registry 收紧。
- `child` 事件目前主要透传 assistant / tool 类，confirm_required 等嵌套事件仍需扩展。
- Agent Panel UI 对 child 事件是角标版渲染，未做嵌套树状折叠。

**Risk:** Agent 能力是产品差异化核心，但如果权限、模型路由和嵌套可视化没有闭合，用户会难以理解和控制 agent 行为。

**Recommendation:** 将 Agent 能力拆成稳定支持和实验支持。稳定能力必须具备权限边界、模型选择、确认流、可观测 UI 和失败恢复。

### 6. macOS 发布仍是未签名/未公证 Alpha 形态

**Severity:** Medium

**Evidence:**
- release workflow 明确 `CSC_IDENTITY_AUTO_DISCOVERY=false`。
- `electron-builder.yml` 中 mac `identity: null`。
- 文档说明 Windows NSIS 可自更新，portable 只能手动更新。

**Risk:** 对早期 Alpha 可以接受，但完整产品需要处理 macOS Gatekeeper、安全提示、用户下载信任和发布验证。

**Recommendation:** 在 Beta 前加入签名/公证计划；至少在下载说明中明确未签名状态和安装方式。

---

## Strengths

- 架构方向清楚：renderer、preload、main、local-bff、agent、packages 的职责有文档约束。
- 本地优先定位稳定：项目文件、SQLite、本地模型配置和 API key 边界有明确设计。
- 安全边界意识较强：path sandbox、contextIsolation、nodeIntegration=false、API key 不进入 renderer/agent 等都有设计和测试痕迹。
- 测试基础比普通 Alpha 项目更好：agent runtime、skill、IPC、pathGuard、update、model gateway、local-bff、UI 组件都有测试。
- 发布流水线已经起步：三平台 CI、tag release、Windows installer/portable、macOS/Linux artifacts、updater fallback 都已有基础。

---

## Productization Direction

推荐采用“可信 Alpha -> 可用 Beta -> 完整产品”的路径。

**可信 Alpha:** 修复项目外部信任面，不扩大承诺。目标是让用户看到的 README、下载包、版本、License、安全策略和实际可用能力一致。

**可用 Beta:** 补齐核心创作闭环的可靠性。目标是项目创建、打开、编辑、AI 生成、保存、版本时间线、恢复、更新都能稳定通过端到端验证。

**完整产品:** 再扩大 Agent/Auto Mode 的自动化能力。目标是让复杂编排具备可控、可恢复、可解释、可回滚的产品体验。

---

## Review Limitations

- 未运行 `pnpm test`、`pnpm lint`、`pnpm typecheck`。
- 未启动 Electron 应用验证真实 UI。
- 未验证 GitHub Releases 中实际产物是否存在、是否可安装。
- 未做依赖安全扫描或第三方许可证审计。


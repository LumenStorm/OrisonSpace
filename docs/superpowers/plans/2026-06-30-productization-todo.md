# Orison Space 产品化 TODO 与需求对齐

> **For agentic workers:** REQUIRED READING: 先阅读 `2026-06-30-productization-review.md`。本文是需求对齐和产品化路线 TODO，不是可直接盲目执行的开发计划。执行任何代码改动前，需要先确认本文的“待对齐问题”。

**Goal:** 把 Orison Space 从当前 Alpha 产品雏形推进到可被用户信任、可持续发布、可维护扩展的完整产品。

**Architecture:** 保持当前本地优先桌面应用方向：Electron main 承担安全边界、模型网关、文件系统和 agent 生命周期；renderer 只通过 preload API 与 main 交互；local-bff 负责本地项目读写；workspace packages 承担跨进程 contracts、模型协议、story-sync 等可测试逻辑。

**Tech Stack:** TypeScript, React, Zustand, Electron IPC, Vitest, pnpm monorepo, Turbo, dependency-cruiser, ESLint, electron-builder.

---

## Guardrails

- 不在需求未确认前扩大功能承诺。
- 不把实验性能力写成稳定卖点。
- 不为了修文档而改动产品行为。
- 不绕过 renderer -> preload -> main -> local-bff 的安全边界。
- 不新增云端账号、远程数据库或服务端依赖，除非产品定位重新确认。
- 所有用户可见文案必须保持 UTF-8，并同步中文/英文。
- TODO 执行后必须补对应验证命令或人工验收标准。

---

## 待对齐问题

- [ ] **产品定位:** 继续坚持“开源、本地优先、BYO API Key、无账号”吗？还是未来会加入云同步/账号/商业服务？
- [ ] **首个稳定用户画像:** 优先服务网文/长篇小说作者，还是扩展到剧本、分镜、视频策划？
- [ ] **核心闭环定义:** Beta 前必须稳定的是“项目管理 + 章节编辑 + AI 生成/续写/润色/审阅 + 保存 + 时间线”，还是还必须包含图片生成、Agent、Auto Mode？
- [ ] **Agent 承诺边界:** Agent orchestration 是当前主卖点，还是先作为实验功能保留？
- [ ] **Auto Mode 策略:** 现在降级隐藏/标注，还是投入重建真实执行引擎？
- [ ] **发布平台优先级:** Windows 优先，还是三平台同等优先？
- [ ] **开源治理:** 是否接受外部贡献？如果接受，是否需要 roadmap、issue labels、good first issue、贡献者开发环境说明？
- [ ] **商业化边界:** 保持完全免费开源，还是预留付费模型路由、插件市场、云备份等方向？

---

## Phase 0: 项目信任面修复

**Goal:** 用户打开 GitHub 首页、下载页、文档时，看到的是清晰、可信、一致的信息。

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `CHANGELOG.md`
- Modify: `SECURITY.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/internal/development-status.md`
- Optional: `.github/ISSUE_TEMPLATE/*`
- Optional: `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: 修复 README 和核心 Markdown 的编码损坏**

  将 README、CHANGELOG、SECURITY、CONTRIBUTING、关键 docs 中的 mojibake 重写为正常 UTF-8。保留中文和英文双语入口，避免损坏链接标题。

- [ ] **Step 2: 统一版本与发布状态**

  当前根包和 shell 是 `0.3.0`，但 changelog/security 仍有旧版本叙事。统一以下内容：
  - 当前版本
  - 最新支持版本
  - Alpha 支持策略
  - release note 链接
  - 下载说明

- [ ] **Step 3: 统一 License 叙事**

  README 和根 `package.json` 采用 Apache-2.0；内部文档中 `Private` 需要改成与当前开源策略一致，或明确标记为历史内容。

- [ ] **Step 4: 补真实截图或短 GIF**

  README 首页需要展示真实产品第一屏：项目页或 workspace，而不是空 TODO。截图应能体现本地项目、章节编辑、Agent/AI 辅助其中至少两个核心卖点。

- [ ] **Step 5: 标注实验性能力**

  对 Agent orchestration、Auto Mode、Video generation、nested sub-agent 等未完全闭合能力，统一标记为 Alpha/Experimental，避免用户误解为完整稳定功能。

**Verification:**
- [ ] 手动检查 README 中文/英文渲染。
- [ ] 手动点击 README 中所有本地文档链接。
- [ ] `rg -n "TODO: Add screenshot|Private|0\\.1\\.x|v0\\.2\\.0\\.\\.\\.HEAD|鈥|馃|涓|鏃" README.md README.en.md CHANGELOG.md SECURITY.md CONTRIBUTING.md docs`

---

## Phase 1: 核心产品闭环验收

**Goal:** 定义并验证“用户可以完成一次真实创作工作”的最小闭环。

**Candidate Core Flow:**
- 创建或打开本地项目。
- 编辑大纲/章节/创作字段。
- 配置 OpenAI-compatible 模型。
- 生成、续写、润色或审阅章节候选。
- 用户预览、接受或拒绝 AI 改动。
- 保存到本地项目文件。
- 创建时间线节点并查看 diff。
- 关闭和重启应用后恢复项目、任务和未完成状态。

- [ ] **Step 1: 写核心闭环验收清单**

  在 docs 中新增一个面向人工验收的 checklist，列出每一步的输入、预期结果和失败处理。

- [ ] **Step 2: 补核心路径测试**

  优先补单元/组件/IPC 层测试，不急着上大而全 e2e。重点覆盖：
  - 保存失败必须可见。
  - 未保存关闭守卫可靠。
  - 外部文件改动冲突可见。
  - 项目注册和最近项目跨重启存在。
  - AI 候选接受后落盘路径正确。

- [ ] **Step 3: 建立 release smoke test**

  每次 release 前至少人工验证 Windows installer/portable。macOS/Linux 在未签名阶段也要有基本启动和打开项目检查。

**Verification:**
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm lint`
- [ ] 手动执行核心闭环 checklist。

---

## Phase 2: Orchestration / Auto Mode 决策

**Goal:** 消除产品承诺与实现之间的最大不一致。

**Option A: 降级为实验功能**

- [ ] README 和 UI 文案改为“实验性 Agent/Auto Mode”。
- [ ] 隐藏或弱化无法真实执行的 Auto Mode 入口。
- [ ] IPC 文档标注当前实现限制。
- [ ] 不把 Auto Mode 放在 Beta 必备范围内。

**Option B: 重建为稳定能力**

- [ ] 定义 Auto Mode 的最小稳定场景：例如“对选定章节逐章生成候选，用户逐章确认”。
- [ ] 将 `orchestrationIpc.ts` 从内存 Map stub 改为真实 service。
- [ ] 将 run state 持久化到项目目录或本地 SQLite。
- [ ] 接入现有 TypeScript `WorkflowRuntime`。
- [ ] 支持暂停、恢复、取消、失败重试、进度事件。
- [ ] UI 展示当前章节、当前步骤、失败原因、可恢复操作。
- [ ] 增加 IPC/service/store/UI 测试。

**Recommendation:** 若目标是尽快做可信 Beta，先选 Option A；若目标是突出差异化，选 Option B 但要把它作为独立里程碑。

---

## Phase 3: Agent 产品化闭环

**Goal:** 让 Agent 从“能跑”升级为“用户可理解、可控制、可恢复”。

- [ ] **Step 1: 定义稳定 Agent 能力集**

  明确哪些是稳定能力：普通对话、工具调用、diff 预览、确认卡片、skill 列表、skill 执行、abort。

- [ ] **Step 2: 收紧子代理权限**

  子代理 frontmatter 中 `tools` 字段不能只给 LLM 阅读，应接入 tool registry 权限收紧。

- [ ] **Step 3: 接入子代理模型路由**

  子代理 frontmatter 中 `model` 字段应接入 model gateway 或明确废弃。

- [ ] **Step 4: 补嵌套事件 UI**

  `child` 事件从角标版升级为可折叠树状展示，至少让用户看懂哪个 skill / subagent 做了什么。

- [ ] **Step 5: 补嵌套确认流**

  subagent / nested skill 内部的 confirm_required 应能透传到父会话并由用户处理。

**Verification:**
- [ ] Agent runtime tests 覆盖模型/工具权限。
- [ ] UI tests 覆盖 child event 渲染。
- [ ] 手动验证 abort 可以终止嵌套执行链。

---

## Phase 4: 质量门禁升级

**Goal:** 从“warning 记录”升级为“产品级回归阻断”。

- [ ] **Step 1: 清 IPC 边界 warning**

  清理 features/store 中直接访问 `window.orisonDesktop` 的存量，统一走 `shared/api/*.ts`。

- [ ] **Step 2: 清 dependency-cruiser warning**

  清理 shared -> features 倒置和循环依赖，清零后升为 error。

- [ ] **Step 3: 让 workspace lint 脚本真实执行**

  替换 `echo ... lint placeholder`。如果仍由根 lint 统一执行，也要在 package scripts 中说明或指向根命令，避免误导贡献者。

- [ ] **Step 4: i18n 裸文本分批清理**

  对用户可见 JSX 文本逐步迁移到 `zh-CN` / `en-US` YAML。

- [ ] **Step 5: 增加死代码和依赖审计节奏**

  将 `pnpm deadcode` 纳入定期检查；Beta 前至少跑一次依赖安全和许可证审计。

**Verification:**
- [ ] `pnpm lint` warning 总数下降。
- [ ] `docs/internal/lint-baseline.md` 更新，数字只能下降。
- [ ] 关键边界规则升为 error 后 CI 仍通过。

---

## Phase 5: 发布与安装产品化

**Goal:** 用户能够安全下载、安装、更新，并理解不同构建形态的限制。

- [ ] **Step 1: Windows installer smoke test**

  验证安装、启动、创建项目、更新检查、卸载。

- [ ] **Step 2: Portable 说明清晰化**

  README 和下载页明确 portable 不支持自更新，只会跳转 release 页面。

- [ ] **Step 3: macOS 签名/公证计划**

  Beta 前确认是否投入 Apple Developer ID。若暂不签名，文档必须明确 Gatekeeper 提示和安装步骤。

- [ ] **Step 4: Linux AppImage 验收**

  验证执行权限、启动、项目目录权限、模型配置路径。

- [ ] **Step 5: 发布回滚策略**

  定义坏版本处理方式：撤 release、hotfix tag、更新说明、用户数据兼容策略。

**Verification:**
- [ ] GitHub Release artifacts 完整。
- [ ] Windows NSIS `latest.yml` 可被 updater 读取。
- [ ] portable zip 解压后可启动。
- [ ] macOS/Linux 构建说明与真实限制一致。

---

## Phase 6: 产品文档与开源治理

**Goal:** 让用户能学会产品，让贡献者知道怎么帮忙。

- [ ] **Step 1: 写用户快速开始**

  包含安装、创建项目、配置模型、写第一章、接受 AI 修改、保存版本。

- [ ] **Step 2: 写数据与隐私说明**

  明确哪些数据在项目目录，哪些在 `~/.orison`，API key 如何加密，模型请求何时离开本地。

- [ ] **Step 3: 写故障排查**

  覆盖模型连接失败、API key 错误、保存失败、更新失败、macOS 未签名提示、SQLite native binding。

- [ ] **Step 4: 建立 roadmap**

  用里程碑表达可信 Alpha、Beta、1.0 的边界。不要把所有愿景塞进 README。

- [ ] **Step 5: 优化 issue/PR 模板**

  增加版本、平台、安装形态、日志位置、是否可复现项目等字段。

---

## Suggested Milestones

### Milestone A: Trustworthy Alpha

- 文档编码正常。
- README 有真实截图。
- 版本、License、安全政策一致。
- 未完成能力被标注为实验性。
- Windows installer/portable 可用。

### Milestone B: Reliable Creative Loop

- 核心创作闭环通过人工验收。
- 保存、恢复、冲突、时间线稳定。
- 模型配置和生成错误有清晰反馈。
- 核心 IPC/data-flow warning 清零并升 error。

### Milestone C: Controlled Agent Workbench

- Agent 权限、模型路由、确认流、嵌套事件 UI 闭合。
- Skill/package 管理稳定。
- Abort 和恢复可靠。

### Milestone D: Beta Release

- 有 release smoke test。
- 三平台下载说明准确。
- macOS 签名策略明确。
- 用户文档和隐私说明完整。

---

## Non-Goals For The Next Pass

- 不引入远程账号系统。
- 不重建云同步。
- 不重做 UI 视觉风格。
- 不把 Auto Mode 和 Agent 所有愿景一次性完成。
- 不新增大型服务端架构。


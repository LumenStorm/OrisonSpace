# Orison Space 长线规划：C -> B -> A

> **For agentic workers:** 本文是长期产品路线图，不是直接执行的代码实现计划。任何具体开发前，应先拆成独立 spec / plan，并与 `2026-06-30-productization-review.md`、`2026-06-30-productization-todo.md` 对齐。

**Goal:** 按“社区飞轮 -> AI 差异化 -> 作品交付闭环”的顺序，把 Orison Space 从本地优先 AI 创作 IDE 推进为具备方法论、生态和交付能力的完整产品。

**Priority Order:** C first, then B, then A.

- **C: Community Flywheel** - 文档、方法论、示例项目、skill 生态和社区协作。
- **B: AI Differentiation** - Agent 工作台、内置 skills、workflow、可控自动化。
- **A: Artifact Delivery** - 配套生图、DOCX/PDF/EPUB 导出、排版模板、成品包。

**Core Thesis:** Orison Space 不只是“一个编辑器加 AI 聊天”，而是一套可以被学习、复用、贡献和扩展的长篇创作系统。先让社区理解方法，再让 Agent 执行方法，最后把作品交付为可展示、可投稿、可传播的成品。

---

## Why C -> B -> A

### 为什么先做 C：社区飞轮

如果先堆功能，用户会看到很多按钮，却不知道如何把它们变成稳定创作流程。Orison Space 的优势更适合先沉淀“怎么写、怎么审、怎么配图、怎么协作、怎么写 skill”的方法论。

社区飞轮的价值是：

- 给普通作者一个明确的使用路径。
- 给贡献者一个明确的参与入口。
- 给后续 Agent/Skills 提供可执行的方法基础。
- 让项目从工具仓库变成创作系统和知识社区。

### 为什么第二阶段做 B：AI 差异化

当方法论清楚后，Agent 和 Skills 才有抓手。否则 Agent 只是聊天，skills 只是 prompt 集合。B 阶段要把 C 阶段沉淀的方法变成可运行、可审阅、可复用的工作流。

AI 差异化的价值是：

- 将创作方法转成可执行流程。
- 让用户通过 diff、确认卡片、审稿报告理解 AI 行为。
- 让社区贡献从“写文章”升级为“贡献 skill/workflow”。
- 形成产品壁垒：不是单次生成，而是长期项目理解和可控自动化。

### 为什么第三阶段做 A：作品交付

导出和排版是用户最终成就感所在，但如果方法和 Agent 还不稳定，导出只能做成普通编辑器功能。等 C 和 B 打好基础后，A 阶段可以把项目中的正文、设定、图片、审稿记录和版本节点整合为完整作品包。

作品交付的价值是：

- 让用户拿到真实可分享成果。
- 让小说、设定图、封面、排版模板形成闭环。
- 支撑投稿、内测阅读、社群展示和商业化内容资产。

---

## North Star

**一句话目标:** 帮助长篇创作者把灵感、设定、章节、审稿、配图、版本和最终交付沉淀在一个本地优先的 AI 创作空间中。

**产品体验目标:**

- 用户知道下一步该做什么。
- AI 的每一步都可解释、可预览、可拒绝、可回滚。
- 项目文件属于用户，不被锁进云端。
- 社区可以贡献方法、skill、模板和示例项目。
- 最终可以导出适合阅读、投稿或展示的作品。

---

## Phase C: Community Flywheel

**Goal:** 先让用户和贡献者理解 Orison Space 是什么、怎么用、怎么扩展。

**Target Users:**

- 想用 AI 写长篇小说但不知道流程的作者。
- 愿意沉淀创作方法的资深作者或编辑。
- 想给项目贡献 skill / workflow / prompt / 模板的开发者。

### C1: 项目外部信任面

- [ ] 修复 README、CHANGELOG、SECURITY、CONTRIBUTING、核心 docs 的编码损坏。
- [ ] 补真实产品截图或短 GIF。
- [ ] 统一版本、License、Alpha 状态和支持策略。
- [ ] 在 README 中明确 C -> B -> A 路线图。
- [ ] 把实验性功能和稳定功能分开写。

**Acceptance Criteria:**

- 新用户打开 GitHub 首页能在 3 分钟内理解产品定位。
- README 链接可点击，中文/英文不乱码。
- 用户不会把未完成的 Auto Mode 误解为稳定能力。

### C2: 创作方法论文档

- [ ] 建立 `docs/methodology/` 或同等目录。
- [ ] 写“长篇小说项目结构”方法：大纲、章节、人物、世界观、伏笔、节奏。
- [ ] 写“AI 辅助而非代写”方法：生成、续写、润色、审稿、可控修改。
- [ ] 写“章节工作流”：章节目标 -> 草稿 -> 审稿 -> 修改 -> 入库。
- [ ] 写“配图工作流”：角色卡/场景卡 -> 图像 brief -> 生成 -> 编辑 -> 入素材库。
- [ ] 写“版本时间线工作流”：何时保存节点，如何分支，如何回看 diff。

**Acceptance Criteria:**

- 普通作者能按文档完成一个小型章节项目。
- 文档中的方法可以直接转化为 skills 或 workflow。

### C3: 示例项目

- [ ] 准备一个小型 demo 小说项目。
- [ ] 包含 project.yaml、章节、角色卡、世界观、伏笔表、记忆、图片占位或生成结果。
- [ ] 配套写“从零到第一章”的 walkthrough。
- [ ] 标注哪些内容是用户写的，哪些是 AI 生成或辅助修改的。

**Acceptance Criteria:**

- 用户能打开示例项目并理解 Orison 的信息结构。
- 示例项目能展示至少一个完整工作流：设定 -> 章节 -> 审稿 -> 修改。

### C4: Skill 生态规范

- [ ] 写 skill 编写指南。
- [ ] 定义 skill 的目录结构、frontmatter、reference、输入输出、确认点。
- [ ] 写 skill 质量标准：可解释、可复用、不要过度承诺、不要绕过用户确认。
- [ ] 写 skill 投稿规范和 review checklist。
- [ ] 建立 starter skills 列表。

**Starter Skills Candidates:**

- 开篇钩子诊断。
- 章节节奏审稿。
- 人物一致性检查。
- 伏笔种植与回收检查。
- 角色图提示词生成。
- 封面 brief 生成。
- 世界观漏洞检查。

**Acceptance Criteria:**

- 贡献者能按照指南写出第一个 skill。
- 内置 starter skills 能覆盖“写作审稿”和“配图准备”两个方向。

### C5: 社区交流入口

- [ ] README 增加社区参与路径。
- [ ] 建立 issue label 约定：bug、feature、skill、methodology、docs、good first issue。
- [ ] 写讨论主题建议：创作方法、skill 提案、示例项目、模型兼容性、排版模板。
- [ ] 准备贡献者 onboarding 文档。

**Acceptance Criteria:**

- 外部用户知道应该提交 bug、提案、skill 还是方法论文档。
- 社区贡献不会只堆散乱 prompt，而是进入统一结构。

---

## Phase B: AI Differentiation

**Goal:** 将 C 阶段的方法论转化为可执行、可审阅、可恢复的 Agent / Skills / Workflow 能力。

### B1: Agent 工作台基础体验

- [ ] 明确稳定 Agent 能力集。
- [ ] 优化 Agent Panel：消息、工具调用、确认卡片、diff、错误状态、历史会话。
- [ ] 让用户能看懂 Agent 正在读什么、改什么、为什么改。
- [ ] 对长任务提供 abort、状态复位和失败提示。

**Acceptance Criteria:**

- 用户可以让 Agent 做一次章节审稿，并清楚看到建议和可接受修改。
- Agent 失败不会卡住 UI。

### B2: Skills 产品化

- [ ] 内置 C 阶段 starter skills。
- [ ] 支持按包启用/禁用 skill。
- [ ] 增加 skill 执行前摘要：目的、输入、可能修改范围。
- [ ] 增加 skill 执行后报告：发现、建议、产物、后续动作。
- [ ] 建立 skill 版本和兼容性说明。

**Acceptance Criteria:**

- 用户能从 UI 中找到、理解、运行 skill。
- skill 输出不是纯文本堆叠，而能形成报告、diff 或 structured artifact。

### B3: 子代理与权限边界

- [ ] 子代理 `tools` frontmatter 接入真实 tool registry 限制。
- [ ] 子代理 `model` frontmatter 接入 model gateway 路由，或明确废弃。
- [ ] 嵌套确认流支持从 child run 透传到父会话。
- [ ] child 事件 UI 从角标升级为可折叠树状过程。

**Acceptance Criteria:**

- 审稿代理、设定代理、图像提示词代理可以有不同工具权限。
- 用户能看懂嵌套 Agent 的执行过程。

### B4: Workflow 模板

- [ ] 章节审稿 workflow：读章节 -> 读设定 -> 输出问题 -> 给出 patch -> 用户确认。
- [ ] 角色一致性 workflow：读人物卡 -> 扫章节 -> 找冲突 -> 给出建议。
- [ ] 配图准备 workflow：读角色/场景 -> 生成 image brief -> 调图像模型或入队。
- [ ] 伏笔 workflow：种植、追踪、回收、遗漏提示。

**Acceptance Criteria:**

- workflow 可以复用 C 阶段方法论。
- workflow 的每个可写操作都有用户确认或可回滚机制。

### B5: 可观测与可恢复

- [ ] Agent run 有清晰状态：idle/running/waiting/failed/done/aborted。
- [ ] 长任务产物落盘或可恢复。
- [ ] continuation / restore 能从 UI 进入。
- [ ] 错误报告包含可行动信息。

**Acceptance Criteria:**

- 应用重启后，用户能知道上次 Agent 做到了哪一步。
- 失败后可以重试或安全放弃。

---

## Phase A: Artifact Delivery

**Goal:** 把项目中的正文、设定、图片和版本记录导出为可阅读、可投稿、可展示的作品成果。

### A1: DOCX 导出

- [ ] 支持章节正文导出。
- [ ] 支持标题层级、目录、作者信息、章节顺序。
- [ ] 支持模板：网文投稿、内部审阅、实体书草稿。
- [ ] 支持选择导出范围：全书、分卷、选中章节。

**Acceptance Criteria:**

- 导出的 DOCX 可以被 Word / WPS 正常打开。
- 标题、段落、目录和章节顺序正确。

### A2: PDF 导出

- [ ] 支持基于模板的 PDF 排版。
- [ ] 支持页眉页脚、页码、目录。
- [ ] 支持审阅版和阅读版。
- [ ] 支持中文字体 fallback 或嵌入策略。

**Acceptance Criteria:**

- 导出的 PDF 适合发给试读者或编辑。
- 中文排版不乱码、不缺字。

### A3: EPUB / Web Export

- [ ] 评估 EPUB 是否进入 1.0 范围。
- [ ] 支持基础章节导航和元数据。
- [ ] 可选支持静态 HTML 预览包。

**Acceptance Criteria:**

- 如果进入范围，必须保证阅读器兼容性。
- 如果不进入范围，README 中不要提前承诺。

### A4: 配套生图闭环

- [ ] 从角色卡生成角色图 brief。
- [ ] 从场景卡生成场景图 brief。
- [ ] 从章节生成插图候选 brief。
- [ ] 从作品定位生成封面 brief。
- [ ] 生图结果进入素材库，并能关联角色、场景、章节或封面用途。
- [ ] 支持生成、编辑、确认入库、替换、删除。

**Acceptance Criteria:**

- 图片不是孤立文件，而能被项目结构引用。
- 用户能知道一张图来自哪个 prompt、哪个模型、哪个项目实体。

### A5: 作品导出包

- [ ] 导出正文。
- [ ] 导出素材图。
- [ ] 导出项目元数据。
- [ ] 导出生成/审稿摘要。
- [ ] 可选导出创作档案：版本节点、主要修改说明、角色表。

**Acceptance Criteria:**

- 用户能把一个项目打包交给编辑、合作者或自己归档。

---

## Cross-Cutting Principles

- **Local-first:** 项目数据默认属于用户，保存在本地。
- **User-led AI:** AI 只能辅助，关键修改必须可预览、可拒绝、可回滚。
- **Method before automation:** 先有方法论，再有 skill，再有 agent workflow。
- **Community contributions as product input:** 社区贡献的不是零散 prompt，而是方法、模板、skill、示例项目。
- **Progressive trust:** Alpha 阶段诚实标注限制，Beta 阶段稳定核心闭环，1.0 阶段承诺完整交付体验。

---

## Milestones

### Milestone C0: Trustworthy Public Face

- README / docs 编码修复。
- 截图补齐。
- 版本、License、安全策略一致。
- C -> B -> A 路线公开。

### Milestone C1: Methodology Starter Kit

- 创作方法论文档初版。
- 示例项目初版。
- Skill 编写指南初版。
- 3-5 个 starter skills 设计完成。

### Milestone B0: Agent Workbench Baseline

- Agent Panel 可稳定执行、显示、确认和失败恢复。
- 内置 starter skills 可运行。
- 子代理权限和模型路由方案明确。

### Milestone B1: Workflow Templates

- 章节审稿 workflow。
- 人物一致性 workflow。
- 图像 brief workflow。
- 伏笔检查 workflow。

### Milestone A0: Export Baseline

- DOCX 导出可用。
- PDF 导出可用。
- 基础排版模板可选。

### Milestone A1: Visual Asset Delivery

- 角色图、场景图、封面 brief 工作流。
- 图片素材与项目实体关联。
- 作品导出包包含正文和素材。

---

## First 30 Days

- [ ] 修复项目文档编码和 README 外观。
- [ ] 写 C -> B -> A 路线图入口。
- [ ] 建立 methodology 目录和目录页。
- [ ] 写第一篇“长篇创作项目结构”方法文档。
- [ ] 写 skill 编写指南草案。
- [ ] 设计 3 个 starter skills：章节节奏审稿、人物一致性检查、角色图提示词生成。
- [ ] 准备一个最小示例项目结构。

---

## Open Questions

- Phase C 第一批内容更偏普通作者教程，还是更偏开发者/贡献者 skill 生态规范？
- 示例项目用中文网文风格，还是中英双语通用风格？
- Starter skills 是否直接放入应用内置 skill 包，还是先以 docs 示例发布？
- 配图能力是否默认走 OpenAI-compatible image endpoint，还是要预留 ComfyUI / Stable Diffusion 本地工作流？
- PDF/DOCX 导出优先满足投稿审阅，还是优先满足精美阅读排版？

---

## Non-Goals

- 不在 C 阶段重做大 UI。
- 不在 B 阶段一次性完成全自动写书。
- 不在 A 阶段承诺专业 DTP 级排版。
- 不引入云端账号或远程数据库作为默认路径。
- 不把社区方法论变成不可维护的散文集合；每篇方法都应能映射到 skill、模板或示例项目。


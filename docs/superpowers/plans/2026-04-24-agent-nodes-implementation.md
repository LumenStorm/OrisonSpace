# 7 个 Agent 节点落实计划

## 参考模式（story-planner-agent）

```python
# 1. 定义 JSON Schema
SCHEMA = { "type": "object", "properties": {...}, "required": [...] }

# 2. run(context) 提取输入
requirement = context["input"]["requirement"]
artifacts = context["input"].get("artifacts", {})

# 3. 渲染 prompt
from python_agent.shared.template import render_template
user_prompt = render_template(context["prompt"]["user"], {"requirement": requirement})

# 4. 调用 LLM
from python_agent.shared.model_client import generate_structured
result = generate_structured(model, system_prompt, user_prompt, SCHEMA)

# 5. 返回结果
from python_agent.shared.result_schema import success
return success(node_id, state_key, artifact=result)
```

## 每个节点的设计

### 1. intake-agent（需求接入）
- 输入：`context["input"]["requirement"]`（原始用户需求）
- LLM 任务：将自由文本需求标准化为结构化对象（genre、tone、setting、premise、constraints）
- Schema：`{ genre, tone, setting, premise, constraints[] }`
- 输出 state_key：`intake.requirement`

### 2. asset-loader-agent（资产装载）
- 输入：`intake.requirement` 产物
- LLM 任务：根据标准化需求推荐项目资产配置（风格指南、参考作品、世界观规则、角色模板）
- Schema：`{ styleGuide, references[], worldRules[], characterTemplates[] }`
- 输出 state_key：`assets.projectContext`

### 3. chapter-task-agent（章节任务卡）
- 输入：`planning.storyPlan` 产物（story-planner 的输出）
- LLM 任务：将故事大纲拆解为章节任务卡，每章包含目标、场景、角色、预期字数
- Schema：`[{ id, title, goal, scenes[], characters[], wordTarget }]`
- 输出 state_key：`planning.chapterTasks`

### 4. draft-writer-agent（正文初稿生成）
- 输入：`planning.storyPlan` + `planning.chapterTasks` + `assets.projectContext`
- LLM 任务：根据章节任务卡生成第一章初稿正文
- Schema：`{ title, text, wordCount, chapterId }`
- 输出 state_key：`draft.initial`

### 5. continuity-memory-agent（连续性记忆更新）
- 输入：`draft.initial` + `planning.storyPlan`
- LLM 任务：从初稿中提取需要跨章节保持一致的要素（角色状态、时间线、伏笔、语调规则）
- Schema：`{ characters[], timeline[], foreshadowing[], toneRules[] }`
- 输出 state_key：`memory.continuity`

### 6. multi-review-agent（多维审核）
- 输入：`draft.initial` + `planning.storyPlan` + `memory.continuity`
- LLM 任务：从多个维度审核初稿（结构完整性、角色一致性、节奏、语调、逻辑漏洞），给出 verdict
- Schema：`{ verdict: "pass"|"revise"|"escalate", summary, dimensions[{ name, score, comment }], reasons[] }`
- 特殊处理：如果 `context["input"]["reviewMode"]` 不是 "pass"，强制使用该 mode 作为 verdict（测试兼容）
- 输出 state_key：`review.latest`
- 额外返回 `review` 字段供 reviewRouter 使用

### 7. targeted-revision-agent（定向修订）
- 输入：`draft.initial` + `review.latest`（审核反馈）
- LLM 任务：根据审核反馈对初稿进行定向修订
- Schema：`{ title, text, wordCount, chapterId, revisionNotes[] }`
- 输出 state_key：`draft.revision`

## 配置文件

为每个节点创建：
- `project-config/agents/{node-id}.yaml` — 节点配置
- `project-config/prompts/{node-id}.yaml` — prompt 模板（system + user）

## 测试策略

- 每个 Python 节点：设置 `OPENAI_RESPONSES_MOCK_JSON` 返回符合 schema 的 mock 数据
- 端到端：runService 测试已有，mock env 下全链路应该自动通过
- Python 单元测试：在 `python-agent/tests/` 下为每个节点添加测试

## 不改动的部分

- registry.ts 中的节点注册（已正确）
- TS 端 nodes/ 目录（仅作为 Python 的 fallback，不影响主链路）
- runService / actionService / routes（已完成）

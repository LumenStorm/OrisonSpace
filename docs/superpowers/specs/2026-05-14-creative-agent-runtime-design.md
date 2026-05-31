# Creative Agent Runtime Design

> Status: Draft
> Date: 2026-05-14

## 1. Goal

Build a desktop-first creative agent runtime inside the existing `OrisonSpace` application.

The runtime must support:

- multi-skill registration and management
- workflow execution across multiple skills
- session tree, subagent dispatch, and resumable runs
- permission and confirmation gates for creative operations
- creative-task context assembly and compaction
- dual-format skill compatibility
  - directory skills such as `SKILL.md + references/ + scripts/`
  - manifest-based native skills

This runtime is not novel-specific. It is a general creative foundation intended to host future skill packs such as long-form fiction writing, script breakdown, adaptation, review, and market analysis.

## 2. Confirmed Scope

### In Scope

- desktop-first runtime evolution on top of the current `apps/agent` and desktop shell flow
- in-place refactor of the current agent internals
- workflow-grade skill execution, not just prompt injection
- dual-format skill support
- runtime-first delivery
  - session tree
  - subagent/task runtime
  - skill registry and routing
  - permission and confirmation
  - context compaction and continuation state

### Out of Scope for v1

- migrating or rewriting the content of `I:\echo\oh-story-claudecode-main`
- embedding long-novel, screenplay, or other domain workflows into the runtime core
- deep standardization of every creative artifact type across all domains
- a host-neutral platform that reaches feature parity across desktop, CLI, and HTTP on day one
- a general-purpose workflow DSL or scripting language
- global knowledge graph or heavy long-term memory infrastructure

## 3. Design Principles

### 3.1 Runtime First

The first version should optimize for orchestration quality rather than domain depth. The runtime must become stable enough that future domain skill packs can rely on it without requiring new core rewrites.

### 3.2 Skill Packs Own Domain Logic

The runtime core must not hardcode "novel", "chapter", "foreshadow", "scene", or "script breakdown" concepts as execution primitives. Domain workflows live in skills and adapters.

### 3.3 Desktop Shell Remains the First Host

The current desktop shell, local tool bridge, and UI remain the primary integration path. The runtime may preserve current APIs where possible, but internal responsibilities will be refactored.

### 3.4 Compatibility Without Freeze

v1 must support both legacy directory skills and native manifest skills. Compatibility is required, but legacy format must not prevent the runtime from having stronger native execution semantics.

### 3.5 Controlled Execution

Creative workflows can overwrite drafts, trigger bulk rewrites, run external scripts, and produce derived content. Permission and review gates are required runtime features, not optional UI polish.

## 4. Recommended Architecture

The runtime should be refactored into five layers inside `apps/agent`.

### 4.1 Host Integration Layer

Responsibilities:

- expose HTTP and SSE routes to the existing desktop UI and proxy layers
- preserve current desktop-first request flow
- translate host requests into runtime commands
- surface runtime events, confirmations, and run status back to the UI

This layer should remain thin and should not own workflow logic.

### 4.2 Creative Runtime Core

Responsibilities:

- manage session tree
- manage run state and workflow lifecycle
- schedule subagents and tasks
- coordinate permission requests and approvals
- own resumable workflow execution state
- coordinate abort, resume, retry, and checkpoint restore

This layer is the new orchestration center.

### 4.3 Skill Runtime

Responsibilities:

- register all available skills
- normalize different skill formats into internal runtime definitions
- resolve triggers and routing candidates
- execute single skills and multi-skill workflows
- support workflow checkpoints, review nodes, and chained execution

This layer upgrades skills from static prompt fragments into executable runtime units.

### 4.4 Context and Memory Layer

Responsibilities:

- assemble task-scoped context for a specific skill run
- resolve references, related artifacts, and recent run state
- compact long conversations into resumable continuation state
- preserve workflow checkpoints and summary layers

This layer must be optimized for long-form creative work rather than code-task summarization.

### 4.5 Tool and Artifact Services

Responsibilities:

- register tools and expose tool capabilities per agent or skill
- classify tools by permission class
- standardize execution results
- offer lightweight artifact read/write/list/query services

This layer does not fully standardize all creative artifacts in v1, but it establishes the minimal runtime contract for artifact-aware skill execution.

## 5. Target Directory Evolution

The refactor should stay in `apps/agent` and move toward a structure similar to:

```text
apps/agent/src/
  host/
    routes/
    sse/
    adapters/
  runtime/
    session/
    workflow/
    subagent/
    permission/
    run-state/
  skill/
    registry/
    adapters/
    workflow/
    manifests/
  context/
    builder/
    compaction/
    memory/
    continuation/
  tool/
    registry/
    permissions/
    services/
  artifact/
    store/
    references/
    summary/
```

The exact file names can vary, but the layering boundary should be enforced.

## 6. Skill Runtime Model

v1 should introduce two normalized internal runtime objects.

### 6.1 SkillDefinition

Represents a loadable skill independent of source format.

Suggested fields:

- `id`
- `version`
- `format`
  - `directory`
  - `manifest`
- `name`
- `description`
- `triggers`
- `allowedTools`
- `allowedSubagents`
- `inputContract`
- `outputContract`
- `references`
- `scripts`
- `hostCompatibility`
- `reviewHooks`

### 6.2 WorkflowDefinition

Represents executable flow rather than a passive prompt.

Suggested fields:

- `workflowId`
- `entrySkill`
- `steps`
- `checkpointPolicy`
- `resumePolicy`
- `failurePolicy`
- `confirmationNodes`
- `reviewNodes`
- `artifactHandoff`

## 7. Dual-Format Skill Compatibility

### 7.1 Directory Skill Adapter

This adapter targets layouts like `I:\echo\oh-story-claudecode-main`.

It should parse:

- `SKILL.md`
- `references/`
- `scripts/`
- optional templates or support assets

The adapter should infer runtime metadata where explicit metadata is absent and compile the result into `SkillDefinition`.

### 7.2 Manifest Skill Adapter

This adapter targets the new native format.

Suggested manifest capabilities:

- explicit metadata
- tool permissions
- input and output contracts
- workflow step declarations
- host compatibility
- review hooks
- checkpoint behavior

### 7.3 Normalization Rule

Both adapters must output the same internal shape. The runtime core must never branch on source format after registration.

## 8. Workflow Execution Model

v1 should support the following workflow node categories:

- `prompt_node`
  - executes a skill prompt or instruction phase
- `tool_node`
  - executes a tool and records normalized output
- `skill_node`
  - invokes another skill as a nested workflow unit
- `review_node`
  - validates current outputs and decides pass, retry, or escalate
- `confirm_node`
  - pauses execution pending user approval
- `checkpoint_node`
  - materializes resumable continuation state

The runtime should support:

- sequential execution
- bounded retries
- simple conditional branching
- explicit confirmation points
- workflow checkpoint save and restore

The runtime should not support a general programmable workflow language in v1.

## 9. Session Tree Model

The current single-threaded session model must evolve into a tree.

### 9.1 Session Roles

- primary session
  - user-facing creative task session
- child session
  - subagent, research, review, or nested skill execution
- forked session
  - branch from a prior message or run checkpoint

### 9.2 Required Operations

- create
- fork
- list children
- resume
- abort
- summarize
- inspect run state

### 9.3 Why This Matters

Creative work regularly branches:

- research before writing
- alternate rewrites
- isolated review passes
- nested skill workflows

These are runtime concerns and should not be modeled as ad hoc message hacks.

## 10. Subagent Model

Subagents must become controlled runtime instances rather than prompt variations.

Each subagent run should have:

- a named role or agent profile
- a reduced permission envelope derived from the parent session
- task-scoped context rather than full parent history
- its own status and resumable execution state

The runtime should support role patterns such as:

- `architect`
- `writer`
- `reviewer`
- `researcher`
- `explorer`

These roles remain runtime roles, not domain-locked story roles.

## 11. Permission Model

v1 should define permission classes suited to creative operations.

Suggested classes:

- `artifact_read`
- `artifact_write`
- `artifact_overwrite`
- `workflow_dispatch`
- `external_reference_fetch`
- `script_execute`
- `bulk_rewrite`
- `destructive_update`

Supported actions:

- `allow`
- `ask`
- `deny`
- `always_allow_pattern`

The runtime must surface permission requests in a stable way so that the desktop UI can continue to provide approval UX.

## 12. Context Assembly and Compaction

The runtime must support context compaction, but not as a copy of code-agent summarization.

### 12.1 Required Memory Layers

- `conversation_summary`
  - compact recent history into execution-relevant narrative
- `workflow_state_snapshot`
  - current workflow position, completed steps, pending confirmations, and next step
- `referenced_artifact_memory`
  - durable pointers to artifacts that should be reloaded instead of re-summarized

### 12.2 Context Builder Responsibilities

For a given skill run, the builder should load only the minimal relevant context, such as:

- current workflow state
- selected artifacts
- related references
- recent summaries
- active review notes

### 12.3 Non-Goal

v1 does not need a full cross-domain unified artifact graph. It only needs enough structure to make long-running skill workflows resumable and context-efficient.

## 13. Lightweight Artifact Layer

v1 should not deeply standardize all creative domains, but it should establish a minimal artifact runtime API.

Suggested capabilities:

- `listArtifacts`
- `readArtifact`
- `writeArtifact`
- `queryReferences`
- `attachArtifactToRun`
- `recordReviewResult`

Suggested generic artifact categories:

- `document`
- `outline`
- `entity`
- `relationship`
- `timeline`
- `beat`
- `reference`
- `review_report`
- `task_brief`

These are generic enough to support future fiction, script, adaptation, and analysis skills without forcing hardcoded story-only runtime semantics.

## 14. Integration with Current Codebase

The runtime should evolve the current agent package rather than replacing the host stack.

### Preserve Where Reasonable

- current desktop-first integration
- current HTTP/SSE entry points where compatibility is useful
- current remote tool bridge where rewrite cost is high

### Refactor Internals

- current route-to-loop coupling
- current direct skill summary injection model
- current flat session assumptions
- current missing permission loop

The target state is an internal re-architecture with minimal host disruption.

## 15. Risks

### 15.1 Half-Old Half-New Runtime

If the host layer and runtime boundaries are not made explicit, the refactor can leave workflow logic scattered across routes, loop code, and UI assumptions.

Mitigation:

- create strict internal service boundaries early
- move routing to adapters only

### 15.2 Dual-Format Complexity

Supporting both directory and manifest skills increases complexity.

Mitigation:

- normalize both formats into one internal definition
- keep format-specific logic inside adapters only

### 15.3 Scope Creep into Artifact Platform

The temptation will be to fully standardize all creative artifact types in v1.

Mitigation:

- keep artifact services lightweight
- defer domain-deep schemas to future phases or skill packs

### 15.4 Desktop Coupling

Desktop-first is the right v1 scope, but can overfit the runtime to one host.

Mitigation:

- keep host integration as a thin adapter layer
- avoid embedding UI assumptions into workflow services

## 16. v1 Success Criteria

v1 is successful when:

- the desktop app still uses the agent through current host pathways
- internal orchestration has moved to a layered creative runtime
- dual-format skills can be discovered and normalized
- single-skill and multi-skill workflows can run
- session tree, subagent runs, permission gates, and checkpoints work
- long-running creative runs can resume from compacted continuation state
- the runtime is ready to host external skill packs such as `oh-story-claudecode-main` without requiring content migration

## 17. Implementation Status

As of 2026-05-14, the v1 runtime foundation described in this document has been implemented inside `apps/agent` and wired through the desktop host stack.

Implemented core capabilities:

- runtime-first orchestration boundary in `apps/agent/src/runtime/workflow.ts`
- session tree primitives with persisted `primary` / `child` / `fork` metadata
- run-state ownership with overlap prevention, abort, and resume checkpoint skeleton
- runtime permission and confirmation flow
- controlled subagent dispatch
- dual-format skill normalization for directory and manifest skills
- workflow-grade skill execution through a runtime skill registry and executor
- external skill root support through runtime config and explicit options
- chat-level `@skill` and `/skill` invocation
- lightweight artifact store and skill context builder
- creative compaction and continuation snapshot primitives
- skill execution responses that now include an explicit continuation payload
- config-aware `GET /v1/agent/skills` host route that merges project and external skill roots
- desktop Agent Panel skill list and direct skill execution entrypoint

Known remaining gaps are product-layer rather than runtime-foundation gaps:

- continuation restore/continue UX is not yet implemented in the desktop UI
- the Agent Panel exposes a minimal skill launcher, not a full workflow workbench
- new Chinese i18n strings for the latest Agent Panel additions were not fully normalized because the existing `zh-CN.yaml` file encoding needs cleanup

## 18. Recommended Delivery Phases

### Phase A: Runtime Restructure

Create the new internal layers and move current orchestration into runtime services.

### Phase B: Session, Permission, and Subagent Core

Introduce session tree, run state, permission requests, and subagent dispatch.

### Phase C: Skill Runtime and Workflow Execution

Introduce skill registry, dual-format adapters, workflow execution, checkpointing, and resume support.

### Phase D: Context, Compaction, and Host Integration

Introduce creative context builder, continuation compaction, UI integration updates, and compatibility validation against external skill packs.

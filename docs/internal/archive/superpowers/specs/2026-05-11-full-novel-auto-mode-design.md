# Full Novel Auto Mode Design

## Goal

Build a full-novel auto mode modeled after `H:\小说\backend`: the user first provides a plot summary, agents generate the reusable story asset bundle, the user approves that bundle, then the system writes chapters in outline order while each chapter feeds newly discovered assets, character facts, relationships, foreshadowing, and long-term memory back into the project.

## Workflow

1. Human enters or confirms the plot summary.
2. Auto mode runs a planning phase and creates a bundle containing:
   - creative brief
   - world setting
   - character/location/lore asset cards
   - relationship graph
   - total outline
   - chapter/episode outlines
   - growth, pacing, and emotion curves
   - foreshadow registry
3. Auto mode stops at `awaiting_approval`.
4. Human approves the generated planning bundle.
5. Auto mode creates missing chapter slots from the approved episode outlines.
6. Auto mode runs the existing chapter pipeline chapter by chapter.
7. After each chapter, existing story-sync and memory extraction nodes update long-term memory and durable creative assets.
8. The loop continues until every planned chapter is completed, or the user pauses/cancels.

## Architecture

The implementation stays in the TypeScript project. It does not port the Python backend's database model. Instead, it mirrors the workflow shape using existing project YAML, orchestration artifacts, and the existing chapter pipeline.

Agent nodes expose reusable metadata through a shared `ReusableAgentNodeContract`. The metadata describes inputs, outputs, required artifacts, produced artifacts, and side effects without binding nodes to a single workflow runner. Full novel auto mode can therefore compose the same planning and sync nodes that other workflows can reuse later.

## Data Model

`NovelAutoModeState` gains:

- `plotSummary`: the human-approved seed summary.
- `status: planning | awaiting_approval | running | paused | completed | cancelled | failed`.
- `planning`: approval state and artifact keys for the generated bundle.

The approved planning bundle is persisted under `runs/auto-mode/<autoModeId>-planning-bundle.yaml` and projected into `project.yaml` under `creative` plus `novel.chapters`.

## UI

The Auto Mode console gets a plot summary text area before start. After planning, it shows the planning phase and an approval button. Approval resumes the continuous chapter loop. Existing pause/resume/cancel behavior remains.

## Error Handling

Planning errors mark the run as `failed` with `lastError`. Chapter errors keep the existing runner behavior and stop the loop as `failed`. Story sync and long-term memory remain best-effort inside the chapter pipeline so one sync failure does not throw away a chapter.

## Testing

Tests cover:

- reusable node contract schema and node metadata
- planning bundle creation from a plot summary
- approval-gated auto mode state transitions
- chapter slot creation from episode outlines
- UI start-with-summary and approval controls

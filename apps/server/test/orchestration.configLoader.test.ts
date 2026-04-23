import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadNodeConfig, resolvePromptTemplate } from '../src/modules/orchestration/config/loader';

describe('orchestration config loader', () => {
  let root = '';

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('loads a project-level node config and resolves its prompt yaml', () => {
    root = mkdtempSync(path.join(tmpdir(), 'orison-orchestration-'));
    writeFileSync(
      path.join(root, 'story-planner-agent.yaml'),
      `
agentId: story-planner-agent
model: gpt-5.4
prompt:
  file: ./story-planner-prompt.yaml
  systemKey: system
  userKey: user
inputs:
  fromState: [intake.requirement]
  mappings:
    requirement: intake.requirement
outputs:
  artifactType: story_plan
  stateKey: planning.storyPlan
review:
  passRules: [has_structure]
  escalateOn: [missing_conflict]
`.trim()
    );
    writeFileSync(
      path.join(root, 'story-planner-prompt.yaml'),
      `
system: |
  planner-system
user: |
  requirement: {{requirement}}
`.trim()
    );

    const config = loadNodeConfig({
      configRoot: root,
      agentId: 'story-planner-agent'
    });
    const prompt = resolvePromptTemplate({
      configRoot: root,
      config,
      variables: { requirement: 'Write a dark opening.' }
    });

    expect(config.prompt.file).toBe('./story-planner-prompt.yaml');
    expect(prompt.system).toContain('planner-system');
    expect(prompt.user).toContain('Write a dark opening.');
  });
});

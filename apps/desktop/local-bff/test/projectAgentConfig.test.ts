import { describe, expect, it } from 'vitest';
import { resolveProjectAgentConfigRoot } from '../orchestration/config/projectAgentConfig';

describe('project agent config root', () => {
  it('maps a project path to the default agent config directory', () => {
    const root = resolveProjectAgentConfigRoot('I:/workspace/demo');
    expect(root).toBe('I:/workspace/demo/project-config/agents');
  });
});

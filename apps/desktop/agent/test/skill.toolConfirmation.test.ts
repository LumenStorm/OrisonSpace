import { describe, expect, it, vi } from 'vitest';
import { skillTool } from '../src/tool/skill';
import type { PendingConfirmationState, ToolContext } from '../src/types';

// #3: when the LLM invokes the `skill` tool mid-loop and the skill pauses on a
// tool confirmation, that confirmation must be surfaced to the UI via
// emitConfirmation — not silently swallowed (it used to only render as text).

describe('skill tool confirmation surfacing', () => {
  function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
    return {
      sessionId: 'session-1',
      projectPath: 'I:/proj',
      abort: new AbortController().signal,
      ...overrides,
    };
  }

  it('emits a confirm_required for each pending confirmation the skill returns', async () => {
    const pending: PendingConfirmationState[] = [
      { sessionId: 'session-1', callId: 'call-1', name: 'write_file', input: { path: 'a.md' }, createdAt: 1 },
      { sessionId: 'session-1', callId: 'call-2', name: 'chapter_write', input: { id: 'c1' }, createdAt: 2 },
    ];
    const emitConfirmation = vi.fn();
    const executeSkillByName = vi.fn().mockResolvedValue({
      skill: 'story',
      outputs: ['done'],
      checkpoints: [],
      pendingConfirmations: pending,
      nested: [],
    });

    const ctx = makeCtx({
      skillExecutor: { executeSkillByName, runSubagent: vi.fn() } as any,
      emitConfirmation,
    });

    const result = await skillTool.execute({ name: 'story', input: 'go' }, ctx);

    expect(emitConfirmation).toHaveBeenCalledTimes(2);
    expect(emitConfirmation).toHaveBeenNthCalledWith(1, pending[0]);
    expect(emitConfirmation).toHaveBeenNthCalledWith(2, pending[1]);
    expect(result.terminal).toBe(true);
  });

  it('does not throw when no emitConfirmation channel is wired (non-streaming path)', async () => {
    const executeSkillByName = vi.fn().mockResolvedValue({
      skill: 'story',
      outputs: ['done'],
      checkpoints: [],
      pendingConfirmations: [
        { sessionId: 'session-1', callId: 'call-1', name: 'write_file', input: {}, createdAt: 1 },
      ],
      nested: [],
    });
    const ctx = makeCtx({ skillExecutor: { executeSkillByName, runSubagent: vi.fn() } as any });

    await expect(skillTool.execute({ name: 'story', input: 'go' }, ctx)).resolves.toBeTruthy();
  });
});

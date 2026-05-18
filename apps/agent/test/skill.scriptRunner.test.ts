import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('skill script runner', () => {
  let root = '';
  let skillDir = '';
  let scriptsDir = '';

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'orison-skill-script-runner-'));
    skillDir = path.join(root, 'story');
    scriptsDir = path.join(skillDir, 'scripts');
    mkdirSync(scriptsDir, { recursive: true });

    writeFileSync(path.join(scriptsDir, 'echo.js'), `
console.log('stdout:' + process.argv.slice(2).join(','));
console.error('stderr:warn');
`, 'utf-8');

    writeFileSync(path.join(scriptsDir, 'sleep.js'), `
setTimeout(() => {
  console.log('done');
}, 200);
`, 'utf-8');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('runs only scripts under the skill scripts directory and captures stdout/stderr', async () => {
    const runner = await import('../src/skill/runtime/scriptRunner');

    const result = await runner.runSkillScript({
      skillDir,
      scriptPath: 'scripts/echo.js',
      args: ['chapter-1', '--unsafe', 'ok_value'],
      timeoutMs: 2000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('chapter-1');
    expect(result.stdout).toContain('ok_value');
    expect(result.stdout).not.toContain('--unsafe');
    expect(result.stderr).toContain('stderr:warn');
    expect(result.scriptPath).toBe(path.join(scriptsDir, 'echo.js'));
  });

  it('rejects scripts outside the skill scripts directory', async () => {
    const runner = await import('../src/skill/runtime/scriptRunner');

    await expect(runner.runSkillScript({
      skillDir,
      scriptPath: '..\\..\\outside.js',
      args: [],
      timeoutMs: 2000,
    })).rejects.toThrow(/outside the skill scripts directory/i);
  });

  it('times out long-running scripts', async () => {
    const runner = await import('../src/skill/runtime/scriptRunner');

    await expect(runner.runSkillScript({
      skillDir,
      scriptPath: 'scripts/sleep.js',
      args: [],
      timeoutMs: 50,
    })).rejects.toThrow(/timed out/i);
  });
});

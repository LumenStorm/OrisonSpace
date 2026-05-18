import { spawn } from 'node:child_process';
import path from 'node:path';

export interface RunSkillScriptInput {
  skillDir: string;
  scriptPath: string;
  args: string[];
  timeoutMs: number;
}

export interface SkillScriptResult {
  scriptPath: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runSkillScript(input: RunSkillScriptInput): Promise<SkillScriptResult> {
  const resolvedScriptPath = validateScriptPath(input.skillDir, input.scriptPath);
  const normalizedArgs = normalizeScriptArgs(input.args);

  return new Promise<SkillScriptResult>((resolve, reject) => {
    const child = spawn(process.execPath, [resolvedScriptPath, ...normalizedArgs], {
      cwd: input.skillDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`script timed out after ${input.timeoutMs}ms`));
    }, input.timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(collectScriptResult(resolvedScriptPath, code ?? 0, stdout, stderr));
    });
  });
}

export function validateScriptPath(skillDir: string, scriptPath: string): string {
  const scriptsRoot = path.resolve(skillDir, 'scripts');
  const resolved = path.resolve(skillDir, scriptPath);
  const normalizedScriptsRoot = scriptsRoot.toLowerCase();
  const normalizedResolved = resolved.toLowerCase();

  if (normalizedResolved !== normalizedScriptsRoot
    && !normalizedResolved.startsWith(`${normalizedScriptsRoot}${path.sep}`)) {
    throw new Error('script path is outside the skill scripts directory');
  }

  return resolved;
}

export function normalizeScriptArgs(args: string[]): string[] {
  return args.filter((arg) => /^[a-zA-Z0-9._=:-]+$/.test(arg) && !arg.startsWith('--'));
}

export function collectScriptResult(
  scriptPath: string,
  exitCode: number,
  stdout: string,
  stderr: string,
): SkillScriptResult {
  return {
    scriptPath,
    exitCode,
    stdout,
    stderr,
  };
}

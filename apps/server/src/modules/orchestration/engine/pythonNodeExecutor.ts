import { spawn } from 'node:child_process';
import path from 'node:path';
import type { PythonRunnerRequest, PythonRunnerResponse } from '../contracts/pythonExecutor';

// 从当前文件位置推算 monorepo 根目录（apps/server/src/modules/orchestration/engine → 上6级）
const MONOREPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..', '..', '..');

type ExecutePythonNodeInput = {
  pythonCommand: string;
  runnerPath: string;
  request: PythonRunnerRequest;
  workspaceRoot?: string;
};

export async function executePythonNode({
  pythonCommand,
  runnerPath,
  request,
  workspaceRoot
}: ExecutePythonNodeInput): Promise<PythonRunnerResponse> {
  return new Promise((resolve, reject) => {
    const resolvedWorkspaceRoot = workspaceRoot ?? MONOREPO_ROOT;
    const child = spawn(pythonCommand, [path.resolve(resolvedWorkspaceRoot, runnerPath)], {
      cwd: resolvedWorkspaceRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python runner failed (${code}): ${stderr}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as PythonRunnerResponse);
      } catch (error) {
        reject(new Error(`Invalid Python runner JSON: ${String(error)}`));
      }
    });

    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}

export async function executePythonNodeWithTimeout(
  input: ExecutePythonNodeInput,
  timeoutMs: number
): Promise<PythonRunnerResponse> {
  return Promise.race([
    executePythonNode(input),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Python node timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

import { spawn } from 'node:child_process';
import path from 'node:path';
import type { PythonRunnerRequest, PythonRunnerResponse } from '../contracts/pythonExecutor';

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
    const resolvedWorkspaceRoot = workspaceRoot ?? path.resolve(process.cwd(), '../..');
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

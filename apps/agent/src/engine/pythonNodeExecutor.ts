import { spawn } from 'node:child_process';
import path from 'node:path';
import type { PythonRunnerRequest, PythonRunnerResponse } from '../contracts/pythonExecutor';

// 从当前文件位置推算 agent 根目录（apps/agent/src/engine → 上2级）
const AGENT_ROOT = path.resolve(import.meta.dirname, '..', '..');

type ExecutePythonNodeInput = {
  pythonCommand: string;
  runnerPath: string;
  request: PythonRunnerRequest;
  workspaceRoot?: string;
  modelEnv?: { apiKey?: string; baseUrl?: string };
};

export async function executePythonNode({
  pythonCommand,
  runnerPath,
  request,
  workspaceRoot,
  modelEnv
}: ExecutePythonNodeInput): Promise<PythonRunnerResponse> {
  return new Promise((resolve, reject) => {
    const resolvedWorkspaceRoot = workspaceRoot ?? AGENT_ROOT;
    const env: Record<string, string | undefined> = { ...process.env };
    if (modelEnv?.apiKey) env.OPENAI_API_KEY = modelEnv.apiKey;
    if (modelEnv?.baseUrl) env.OPENAI_BASE_URL = modelEnv.baseUrl;
    // Windows 默认用 ANSI/GBK 解码 stdin，会破坏中文/路径中的反斜杠转义。
    // 强制 Python 子进程用 UTF-8 读取 stdin/stdout/stderr。
    env.PYTHONIOENCODING = 'utf-8';
    env.PYTHONUTF8 = '1';

    const child = spawn(pythonCommand, [path.resolve(resolvedWorkspaceRoot, runnerPath)], {
      cwd: resolvedWorkspaceRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      env
    });

    let stdout = '';
    let stderr = '';

    // 显式指定 UTF-8 编码，避免 Windows 默认编码导致的字符破坏
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

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

    const payload = JSON.stringify(request);
    // 显式以 UTF-8 字节写入 stdin，避免被 Windows 默认 codepage 转换
    child.stdin.write(Buffer.from(payload, 'utf8'));
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

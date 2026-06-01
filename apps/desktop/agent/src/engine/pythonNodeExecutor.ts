import { spawn } from 'node:child_process';
import path from 'node:path';
import { buildPythonSpawnCommand, resolvePythonCommand } from './pythonRuntime';

interface PythonNodeRequest {
  runId: string;
  nodeId: string;
  nodeFile: string;
  configFile?: string;
  projectPath: string;
  config: Record<string, unknown>;
  prompt: { system: string; user: string };
  input: Record<string, unknown>;
}

interface PythonNodeSuccess {
  ok: true;
  node_id: string;
  state_key?: string;
  stateKey?: string;
  artifact: unknown;
}

interface PythonNodeFailure {
  ok: false;
  error: { type: string; message: string; retryable: boolean };
}

type PythonNodeResult = PythonNodeSuccess | PythonNodeFailure;

interface ExecuteOptions {
  pythonCommand?: string;
  runnerPath?: string;
  request: PythonNodeRequest;
  timeoutMs?: number;
}

export async function executePythonNode(options: ExecuteOptions): Promise<PythonNodeResult> {
  const { request, timeoutMs = 30000 } = options;
  const pythonCommand = options.pythonCommand ?? resolvePythonCommand();
  const runnerPath = options.runnerPath ?? path.join(__dirname, '../../python/runner/main.py');
  const spawnCommand = buildPythonSpawnCommand(pythonCommand, [runnerPath]);

  return new Promise((resolve, reject) => {
    const proc = spawn(spawnCommand.command, spawnCommand.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });

    proc.on('close', (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(`Python node ${request.nodeId} exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as PythonNodeResult);
      } catch {
        reject(new Error(`Failed to parse python output for ${request.nodeId}: ${stdout}`));
      }
    });

    proc.on('error', (err) => reject(err));

    proc.stdin.write(JSON.stringify(request), 'utf8');
    proc.stdin.end();
  });
}

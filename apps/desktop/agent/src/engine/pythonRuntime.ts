import { existsSync } from 'node:fs';
import path from 'node:path';

type EnvLike = Record<string, string | undefined>;

interface ResolveAgentPythonDirOptions {
  env?: EnvLike;
  resourcesPath?: string;
  sourceDir?: string;
  exists?: (candidate: string) => boolean;
}

const MIN_PYTHON_MAJOR = 3;
const MIN_PYTHON_MINOR = 10;

interface ResolvePythonCommandOptions {
  env?: EnvLike;
  resourcesPath?: string;
  exists?: (candidate: string) => boolean;
}

export function resolveEmbeddedPython(options: ResolvePythonCommandOptions = {}): string | undefined {
  const exists = options.exists ?? existsSync;
  const resourcesPath = options.resourcesPath ?? (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (!resourcesPath) return undefined;
  const exe = path.join(resourcesPath, 'python-runtime', 'python.exe');
  return exists(exe) ? exe : undefined;
}

export function resolvePythonCommand(options: EnvLike | ResolvePythonCommandOptions = {}): string {
  // Back-compat: callers pass an env map directly.
  const opts: ResolvePythonCommandOptions =
    options && ('env' in options || 'resourcesPath' in options || 'exists' in options)
      ? (options as ResolvePythonCommandOptions)
      : { env: options as EnvLike };
  const env = opts.env ?? process.env;

  const configured = env.ORISON_PYTHON_COMMAND?.trim();
  if (configured) return configured;

  const embedded = resolveEmbeddedPython(opts);
  if (embedded) return embedded;

  return 'python';
}

export function buildPythonSpawnCommand(
  pythonCommand: string,
  runnerArgs: string[],
  exists: (candidate: string) => boolean = existsSync,
): { command: string; args: string[] } {
  // An absolute path to an existing interpreter (e.g. the embedded python.exe,
  // whose path may contain spaces like "Orison Space") must not be split.
  if (path.isAbsolute(pythonCommand) && exists(pythonCommand)) {
    return { command: pythonCommand, args: runnerArgs };
  }
  const parts = pythonCommand.trim().split(/\s+/).filter(Boolean);
  const command = parts[0] || 'python';
  return { command, args: [...parts.slice(1), ...runnerArgs] };
}

export function resolveAgentPythonDir(options: ResolveAgentPythonDirOptions = {}): string {
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  const configured = env.ORISON_AGENT_PYTHON_DIR?.trim();
  if (configured) return path.resolve(configured);

  const resourcesPath = options.resourcesPath ?? (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const packagedDir = resourcesPath ? path.join(resourcesPath, 'python') : undefined;
  if (packagedDir && exists(packagedDir)) return packagedDir;

  const sourceDir = options.sourceDir ?? path.resolve(__dirname, '../../python');
  if (exists(sourceDir)) return sourceDir;

  return packagedDir ?? sourceDir;
}

export function isSupportedPythonVersion(output: string): boolean {
  const match = output.match(/Python\s+(\d+)\.(\d+)(?:\.\d+)?/i);
  if (!match) return false;

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  if (major > MIN_PYTHON_MAJOR) return true;
  return major === MIN_PYTHON_MAJOR && minor >= MIN_PYTHON_MINOR;
}

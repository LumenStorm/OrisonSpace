import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPythonSpawnCommand,
  isSupportedPythonVersion,
  resolveAgentPythonDir,
  resolveEmbeddedPython,
  resolvePythonCommand,
} from '../src/engine/pythonRuntime';

describe('python runtime packaging helpers', () => {
  it('uses python from PATH by default and allows an env override', () => {
    expect(resolvePythonCommand({})).toBe('python');
    expect(resolvePythonCommand({ ORISON_PYTHON_COMMAND: 'py -3.11' })).toBe('py -3.11');
    expect(resolvePythonCommand({ ORISON_PYTHON_COMMAND: '   ' })).toBe('python');
  });

  it('prefers the embedded interpreter over PATH when packaged', () => {
    const resourcesPath = path.resolve('C:/Program Files/Orison Space/resources');
    const embedded = path.join(resourcesPath, 'python-runtime', 'python.exe');
    expect(resolveEmbeddedPython({ resourcesPath, exists: (c) => c === embedded })).toBe(embedded);
    expect(resolvePythonCommand({ env: {}, resourcesPath, exists: (c) => c === embedded })).toBe(embedded);
    // env override still wins over the embedded interpreter
    expect(
      resolvePythonCommand({ env: { ORISON_PYTHON_COMMAND: 'py -3.11' }, resourcesPath, exists: () => true }),
    ).toBe('py -3.11');
  });

  it('splits a python command override before appending runner args', () => {
    expect(buildPythonSpawnCommand('python', ['runner/main.py'])).toEqual({
      command: 'python',
      args: ['runner/main.py'],
    });
    expect(buildPythonSpawnCommand('py -3.11', ['runner/main.py'])).toEqual({
      command: 'py',
      args: ['-3.11', 'runner/main.py'],
    });
  });

  it('does not split an absolute interpreter path containing spaces', () => {
    const exe = 'C:\\Program Files\\Orison Space\\resources\\python-runtime\\python.exe';
    expect(buildPythonSpawnCommand(exe, ['runner/main.py'], () => true)).toEqual({
      command: exe,
      args: ['runner/main.py'],
    });
  });

  it('prefers packaged resources when the python directory is present there', () => {
    const resourcesPath = path.resolve('C:/Program Files/Orison Space/resources');
    const sourceDir = path.resolve('C:/repo/apps/desktop/agent/python');
    const packagedDir = path.join(resourcesPath, 'python');

    const result = resolveAgentPythonDir({
      resourcesPath,
      sourceDir,
      exists: (candidate) => candidate === packagedDir || candidate === sourceDir,
    });

    expect(result).toBe(packagedDir);
  });

  it('falls back to the source python directory outside packaged installs', () => {
    const resourcesPath = path.resolve('C:/Program Files/Orison Space/resources');
    const sourceDir = path.resolve('C:/repo/apps/desktop/agent/python');

    const result = resolveAgentPythonDir({
      resourcesPath,
      sourceDir,
      exists: (candidate) => candidate === sourceDir,
    });

    expect(result).toBe(sourceDir);
  });

  it('accepts Python 3.10+ version output and rejects older or invalid versions', () => {
    expect(isSupportedPythonVersion('Python 3.10.0')).toBe(true);
    expect(isSupportedPythonVersion('Python 3.12.4')).toBe(true);
    expect(isSupportedPythonVersion('Python 3.9.13')).toBe(false);
    expect(isSupportedPythonVersion('not python')).toBe(false);
  });
});

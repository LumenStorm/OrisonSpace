import { ipcMain, BrowserWindow } from 'electron';
import {
  createWorkflowRuntime,
  setGenerateTextFn,
  setExecuteToolFn,
  registerBuiltinTools,
  loadRuntimeConfig,
  listSkillPackages,
  setPackageEnabled,
  setSkillEnabled,
  type WorkflowRuntime,
  type CreateSessionInput,
  type ExecuteSkillRequest,
  type GenerateTextFn,
  type ExecuteToolFn,
} from '@orison/desktop-agent';
import { handleGenerateText } from './modelGatewayIpc';
import { handleToolExecute } from './toolExecution';
import { getLogger } from '../logger';

const logger = getLogger();

let runtime: WorkflowRuntime;

export function registerAgentIpc(mainWindow: BrowserWindow) {
  const generateTextImpl: GenerateTextFn = async (body, _abort) => {
    const result = await handleGenerateText(body as any);
    return result as any;
  };
  setGenerateTextFn(generateTextImpl);

  const executeToolImpl: ExecuteToolFn = async (toolId, params, ctx) => {
    return handleToolExecute({
      toolId,
      params: params as Record<string, unknown>,
      projectDir: ctx.projectDir,
      sessionId: ctx.sessionId,
    });
  };
  setExecuteToolFn(executeToolImpl);

  registerBuiltinTools();

  runtime = createWorkflowRuntime();

  // ─── Request/Response handlers ───

  ipcMain.handle('agent:create-session', async (_event, input: CreateSessionInput) => {
    const runtimeConfig = await loadRuntimeConfig(input.projectPath);
    const sessionRuntime = createWorkflowRuntime({
      externalSkillRoots: runtimeConfig.externalSkillRoots,
    });
    return sessionRuntime.createSession(input);
  });

  ipcMain.handle('agent:get-session', async (_event, id: string, projectPath?: string) => {
    return runtime.getSession(id, projectPath) ?? null;
  });

  ipcMain.handle('agent:list-sessions', async (_event, projectPath?: string) => {
    return runtime.listSessions(projectPath);
  });

  ipcMain.handle('agent:delete-session', async (_event, id: string) => {
    return runtime.deleteSession(id);
  });

  ipcMain.handle('agent:resolve-confirmation', async (_event, sessionId: string, callId: string, approved: boolean) => {
    return runtime.resolveConfirmation(sessionId, callId, approved);
  });

  ipcMain.handle('agent:list-skills', async (_event, projectPath: string) => {
    return runtime.listSkills(projectPath);
  });

  ipcMain.handle('agent:execute-skill', async (_event, sessionId: string, skillName: string, request?: string | ExecuteSkillRequest) => {
    return runtime.executeSkillByName(sessionId, skillName, request);
  });

  ipcMain.handle('agent:list-continuations', async (_event, sessionId: string) => {
    return runtime.listContinuations(sessionId);
  });

  ipcMain.handle('agent:restore-continuation', async (_event, sessionId: string, continuationId: string) => {
    return runtime.restoreContinuation(sessionId, continuationId);
  });

  ipcMain.handle('agent:abort-run', async (_event, sessionId: string) => {
    return runtime.abortRun(sessionId);
  });

  // ─── Skill package management ───

  ipcMain.handle('agent:list-skill-packages', async () => {
    return listSkillPackages();
  });

  ipcMain.handle('agent:set-package-enabled', async (_event, packageName: string, enabled: boolean) => {
    await setPackageEnabled(packageName, enabled);
    return { ok: true };
  });

  ipcMain.handle('agent:set-skill-enabled', async (_event, packageName: string, skillName: string, enabled: boolean) => {
    await setSkillEnabled(packageName, skillName, enabled);
    return { ok: true };
  });

  // ─── Streaming handler ───

  ipcMain.handle('agent:stream-message', async (_event, input: { sessionId: string; content: string }) => {
    const abortController = new AbortController();

    // Store abort controller so it can be cancelled via agent:abort-run
    const sendEvent = (event: { type: string; data: unknown }) => {
      try {
        mainWindow.webContents.send('agent:stream-event', event);
      } catch {
        // Window may have been closed
      }
    };

    try {
      await runtime.streamMessage({
        sessionId: input.sessionId,
        content: input.content,
        abortSignal: abortController.signal,
        sendEvent,
      });
      return { status: 'completed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message, sessionId: input.sessionId }, 'agent stream error');
      return { status: 'error', message };
    }
  });
}

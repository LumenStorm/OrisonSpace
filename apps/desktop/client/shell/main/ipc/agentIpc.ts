import { ipcMain, BrowserWindow } from 'electron';
import {
  createWorkflowRuntime,
  setGenerateTextFn,
  setExecuteToolFn,
  registerBuiltinTools,
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

/** In-flight stream abort controllers, keyed by sessionId, for agent:abort-run. */
const streamAbortControllers = new Map<string, AbortController>();

let registered = false;

export function registerAgentIpc(getWin: () => BrowserWindow | null) {
  // Handlers register once for the app lifetime; a recreated window is resolved
  // lazily via getWin. Re-registering the same channel would throw.
  if (registered) {
    return;
  }
  registered = true;

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

  // Use the single shared `runtime` for the whole session lifecycle. Previously
  // create-session built a *separate* runtime carrying externalSkillRoots, while
  // get-session/execute-skill/stream-message used this module-level one — two
  // divergent instances with their own session caches and skill registries, so
  // external skills listed but wouldn't execute. The runtime's listSkills /
  // executeSkillByName / buildRuntimeSystemPrompt already load per-project
  // externalSkillRoots via loadRuntimeConfig, so a single instance suffices.
  ipcMain.handle('agent:create-session', async (_event, input: CreateSessionInput) => {
    return runtime.createSession(input);
  });

  ipcMain.handle('agent:get-session', async (_event, id: string, projectPath?: string) => {
    return runtime.getSession(id, projectPath) ?? null;
  });

  ipcMain.handle('agent:set-session-model', async (_event, sessionId: string, projectPath: string | undefined, modelRef: { keyId: string; modelId: string } | undefined) => {
    // Ensure the session is loaded into memory before mutating it (it may only
    // exist on disk after an app restart).
    runtime.getSession(sessionId, projectPath);
    const ok = runtime.setSessionModel(sessionId, modelRef);
    return { ok };
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
    // Abort the IPC-level controller too, so streamMessage is interrupted even
    // outside the runtime's own run window (defense-in-depth on top of abortRun).
    streamAbortControllers.get(sessionId)?.abort();
    return runtime.abortRun(sessionId);
  });

  // ─── Skill package management ───

  ipcMain.handle('agent:list-skill-packages', async (_event, projectPath?: string) => {
    return listSkillPackages(projectPath);
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

  ipcMain.handle('agent:stream-message', async (_event, input: { sessionId: string; content: string; attachments?: unknown[] }) => {
    const abortController = new AbortController();
    // Track per session so agent:abort-run can cancel an in-flight stream.
    streamAbortControllers.set(input.sessionId, abortController);

    const sendEvent = (event: { type: string; data: unknown }) => {
      try {
        getWin()?.webContents.send('agent:stream-event', event);
      } catch {
        // Window may have been closed
      }
    };

    try {
      await runtime.streamMessage({
        sessionId: input.sessionId,
        content: input.content,
        attachments: input.attachments as Parameters<typeof runtime.streamMessage>[0]['attachments'],
        abortSignal: abortController.signal,
        sendEvent,
      });
      return { status: 'completed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message, sessionId: input.sessionId }, 'agent stream error');
      return { status: 'error', message };
    } finally {
      streamAbortControllers.delete(input.sessionId);
    }
  });
}

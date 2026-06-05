/**
 * Tool Execution Layer — unified entry point for all tool calls from the Agent.
 *
 * In dev mode: exposed as POST /tool/execute on the HTTP gateway.
 * In prod mode: invoked via WebSocket reverse channel.
 */
import { assertSafePath } from './pathGuard';
import { getLogger } from '../logger';

// Handlers
import { readFileHandler, writeFileHandler, listFilesHandler, searchHandler } from './toolHandlers/fileHandlers';
import { chapterListHandler, chapterReadHandler, chapterWriteHandler, rewritePassageHandler } from './toolHandlers/chapterHandlers';
import { outlineReadHandler, outlineUpdateHandler } from './toolHandlers/outlineHandlers';
import { overviewUpdateHandler } from './toolHandlers/overviewHandlers';
import { generateImageHandler, editImageHandler } from './toolHandlers/imageHandlers';
import { gitStatusHandler, gitLogHandler, gitCommitHandler, gitDiffHandler } from './toolHandlers/gitHandlers';
import { projectMetaHandler, memoryQueryHandler, memoryUpdateHandler, skillHandler } from './toolHandlers/projectHandlers';

const logger = getLogger();

// ─── Types ───

export interface ToolExecuteRequest {
  toolId: string;
  params: Record<string, unknown>;
  projectDir: string;
  sessionId: string;
  requestId?: string;
}

export interface ToolExecuteResponse {
  title: string;
  output: string;
  metadata?: Record<string, unknown>;
}

export interface ToolHandlerContext {
  params: Record<string, unknown>;
  projectDir: string;
  sessionId: string;
}

export type ToolHandler = (ctx: ToolHandlerContext) => Promise<ToolExecuteResponse>;

// ─── Registry ───

const handlers = new Map<string, ToolHandler>();

function register(toolId: string, handler: ToolHandler) {
  handlers.set(toolId, handler);
}

// File operations
register('read_file', readFileHandler);
register('write_file', writeFileHandler);
register('list_files', listFilesHandler);
register('search', searchHandler);

// Chapter
register('chapter_list', chapterListHandler);
register('chapter_read', chapterReadHandler);
register('chapter_write', chapterWriteHandler);
register('rewrite_passage', rewritePassageHandler);

// Outline
register('outline_read', outlineReadHandler);
register('outline_update', outlineUpdateHandler);

// Overview
register('overview_update', overviewUpdateHandler);

// Image
register('generate_image', generateImageHandler);
register('edit_image', editImageHandler);

// Git
register('git_status', gitStatusHandler);
register('git_log', gitLogHandler);
register('git_commit', gitCommitHandler);
register('git_diff', gitDiffHandler);

// Project / Memory / Skill
register('project_meta', projectMetaHandler);
register('memory_query', memoryQueryHandler);
register('memory_update', memoryUpdateHandler);
register('skill', skillHandler);

// ─── Execution ───

/**
 * Execute a tool by id. This is the single entry point for all tool calls.
 */
export async function handleToolExecute(req: ToolExecuteRequest): Promise<ToolExecuteResponse> {
  const { toolId, params, projectDir, sessionId } = req;

  // Validate project directory is within allowed scope
  assertSafePath(projectDir);

  const handler = handlers.get(toolId);
  if (!handler) {
    throw new Error(`Unknown tool: ${toolId}`);
  }

  logger.info({ toolId, sessionId, projectDir }, 'tool:execute');

  const result = await handler({ params, projectDir, sessionId });
  return result;
}

/**
 * List all registered tool IDs (for Shell capability reporting).
 */
export function listRegisteredTools(): string[] {
  return [...handlers.keys()];
}

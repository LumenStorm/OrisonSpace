import { z } from 'zod';
import { defineTool } from './define';
import type { ToolDefinition, ToolResult } from '../types';

export type ExecuteToolFn = (toolId: string, params: unknown, ctx: { projectDir: string; sessionId: string; abort: AbortSignal }) => Promise<ToolResult>;

let _executeTool: ExecuteToolFn | undefined;

export function setExecuteToolFn(fn: ExecuteToolFn) {
  _executeTool = fn;
}

export function getExecuteToolFn(): ExecuteToolFn {
  if (!_executeTool) throw new Error('executeTool not initialized — call setExecuteToolFn first');
  return _executeTool;
}

export function remoteToolProxy<T>(def: {
  id: string;
  description: string;
  parameters: z.ZodType<T>;
}): ToolDefinition<T> {
  return defineTool({
    ...def,
    async execute(params, ctx) {
      const fn = getExecuteToolFn();
      return fn(def.id, params, {
        projectDir: ctx.projectPath,
        sessionId: ctx.sessionId,
        abort: ctx.abort,
      });
    },
  });
}

/**
 * Remote tool proxy — delegates tool execution to the Desktop Shell via HTTP.
 *
 * In dev mode: POST http://localhost:18421/tool/execute
 * In prod mode: will be replaced by WebSocket dispatcher (Phase 2).
 */
import { z } from 'zod';
import { defineTool } from './define';
import { env } from '../env';
import type { ToolDefinition, ToolResult } from '../types';

export function remoteToolProxy<T>(def: {
  id: string;
  description: string;
  parameters: z.ZodType<T>;
}): ToolDefinition<T> {
  return defineTool({
    ...def,
    async execute(params, ctx) {
      const res = await fetch(`${env.MODEL_GATEWAY_URL}/tool/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: def.id,
          params,
          projectDir: ctx.projectPath,
          sessionId: ctx.sessionId,
        }),
        signal: ctx.abort,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Tool ${def.id} failed (${res.status}): ${text}`);
      }
      return (await res.json()) as ToolResult;
    },
  });
}

import { z } from 'zod';
import type { ToolContext, ToolDefinition, ToolResult } from '../types';

export function defineTool<TParams>(opts: {
  id: string;
  description: string;
  parameters: z.ZodType<TParams>;
  execute: (params: TParams, ctx: ToolContext) => Promise<ToolResult>;
}): ToolDefinition<TParams> {
  return opts;
}

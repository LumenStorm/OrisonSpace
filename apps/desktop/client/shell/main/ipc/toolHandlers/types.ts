export interface ToolExecuteResponse {
  title: string;
  output: string;
  metadata?: Record<string, unknown>;
}

export interface ToolHandlerContext {
  params: Record<string, unknown>;
  projectDir: string;
  sessionId: string;
  abort: AbortSignal;
}

export type ToolHandler = (ctx: ToolHandlerContext) => Promise<ToolExecuteResponse>;

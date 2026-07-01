import { spawn, type ChildProcess } from 'node:child_process';
import { logger } from '../logger';
import type { McpServerConfig } from './config';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export class McpClient {
  private process: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private buffer = '';

  constructor(private name: string, private config: McpServerConfig) {}

  async connect(): Promise<void> {
    if (!this.config.command) {
      throw new Error(`MCP server "${this.name}" has no command configured`);
    }

    this.process = spawn(this.config.command, this.config.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.config.env },
    });

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      logger.warn({ server: this.name }, chunk.toString().trim());
    });

    this.process.on('exit', (code) => {
      logger.info({ server: this.name, code }, 'MCP server exited');
      this.process = null;
    });

    // Initialize
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'orison-agent', version: '0.1.0' },
    });
  }

  async listTools(): Promise<Array<{ name: string; description?: string; inputSchema?: unknown }>> {
    const result = await this.request('tools/list', {}) as { tools: Array<{ name: string; description?: string; inputSchema?: unknown }> };
    return result.tools ?? [];
  }

  async callTool(name: string, args: unknown): Promise<string> {
    const result = await this.request('tools/call', { name, arguments: args }) as { content: Array<{ type: string; text?: string }> };
    return result.content?.map(c => c.text ?? '').join('\n') ?? '';
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private request(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        return reject(new Error('MCP server not connected'));
      }

      const id = this.nextId++;
      const msg: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
      this.pending.set(id, { resolve, reject });
      this.process.stdin.write(JSON.stringify(msg) + '\n');
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        const pending = this.pending.get(msg.id);
        if (pending) {
          this.pending.delete(msg.id);
          if (msg.error) {
            pending.reject(new Error(msg.error.message));
          } else {
            pending.resolve(msg.result);
          }
        }
      } catch {
        // ignore malformed lines
      }
    }
  }
}

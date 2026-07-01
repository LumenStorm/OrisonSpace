import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface McpServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

export async function loadMcpConfig(projectPath: string): Promise<McpConfig> {
  const locations = [
    path.join(projectPath, '.orison', 'mcp.json'),
  ];

  for (const loc of locations) {
    try {
      const raw = await readFile(loc, 'utf-8');
      return JSON.parse(raw) as McpConfig;
    } catch {
      // try next
    }
  }

  return { servers: {} };
}

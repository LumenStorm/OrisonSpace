import type { ToolDefinition } from '../types';

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  all(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  ids(): string[] {
    return [...this.tools.keys()];
  }
}

export const registry = new ToolRegistry();

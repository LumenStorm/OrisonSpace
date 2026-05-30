import { readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export function loadNodeConfig(opts: { configRoot: string; agentId: string }) {
  const filePath = path.join(opts.configRoot, `${opts.agentId}.yaml`);
  return YAML.parse(readFileSync(filePath, 'utf8'));
}

export function resolvePromptTemplate(opts: {
  configRoot: string;
  config: { prompt: { file: string; systemKey?: string; userKey?: string } };
  variables: Record<string, string>;
}) {
  const promptPath = path.join(opts.configRoot, opts.config.prompt.file);
  const content = YAML.parse(readFileSync(promptPath, 'utf8'));
  const systemKey = opts.config.prompt.systemKey ?? 'system';
  const userKey = opts.config.prompt.userKey ?? 'user';

  let system = content[systemKey] ?? '';
  let user = content[userKey] ?? '';

  for (const [key, val] of Object.entries(opts.variables)) {
    system = system.replaceAll(`{{${key}}}`, val);
    user = user.replaceAll(`{{${key}}}`, val);
  }

  return { system, user };
}

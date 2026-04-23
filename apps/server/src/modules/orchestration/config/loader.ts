import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { orchestrationNodeConfigSchema } from '@orison/shared-contracts';
import type { LoadNodeConfigInput, ResolvePromptTemplateInput } from '../contracts/config';

export function loadNodeConfig({ configRoot, agentId }: LoadNodeConfigInput) {
  const filePath = path.join(configRoot, `${agentId}.yaml`);
  if (!existsSync(filePath)) {
    throw new Error(`Missing node config for ${agentId}: ${filePath}`);
  }

  const raw = readFileSync(filePath, 'utf8');
  return orchestrationNodeConfigSchema.parse(YAML.parse(raw));
}

export function resolvePromptTemplate({ configRoot, config, variables }: ResolvePromptTemplateInput) {
  const promptPath = path.resolve(configRoot, config.prompt.file);
  if (!existsSync(promptPath)) {
    throw new Error(`Missing prompt file for ${config.agentId}: ${promptPath}`);
  }

  const parsed = YAML.parse(readFileSync(promptPath, 'utf8')) as Record<string, string | undefined>;
  const system = parsed[config.prompt.systemKey];
  const user = parsed[config.prompt.userKey];

  if (!system || !user) {
    throw new Error(`Prompt keys not found for ${config.agentId}`);
  }

  return {
    system,
    user: user.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
  };
}

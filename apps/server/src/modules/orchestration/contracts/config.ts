import { z } from 'zod';
import { orchestrationNodeConfigSchema } from '@orison/shared-contracts';

export type NodeConfig = z.infer<typeof orchestrationNodeConfigSchema>;

export type LoadNodeConfigInput = {
  configRoot: string;
  agentId: string;
};

export type ResolvePromptTemplateInput = {
  configRoot: string;
  config: NodeConfig;
  variables: Record<string, string>;
};

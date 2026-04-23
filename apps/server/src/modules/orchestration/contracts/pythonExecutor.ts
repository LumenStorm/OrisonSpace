import type { z } from 'zod';
import type { orchestrationNodeConfigSchema } from '@orison/shared-contracts';

export type PythonNodeConfig = z.infer<typeof orchestrationNodeConfigSchema>;

export type PythonRunnerRequest = {
  runId: string;
  nodeId: string;
  nodeFile: string;
  configFile: string;
  projectPath: string;
  config: PythonNodeConfig;
  prompt: {
    system: string;
    user: string;
  };
  input: {
    requirement: string;
    artifacts: Record<string, unknown>;
  };
};

export type PythonRunnerResponse =
  | {
      ok: true;
      node_id?: string;
      nodeId?: string;
      state_key?: string;
      stateKey?: string;
      artifact: unknown;
      review?: {
        verdict: 'pass' | 'revise' | 'escalate';
        summary: string;
        reasons: string[];
      } | null;
      meta?: Record<string, unknown>;
    }
  | {
      ok: false;
      node_id?: string;
      nodeId?: string;
      error: {
        type: string;
        message: string;
        retryable: boolean;
      };
    };

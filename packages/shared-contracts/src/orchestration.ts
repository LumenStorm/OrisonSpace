import { z } from 'zod';

export const orchestrationStatusSchema = z.enum([
  'pending',
  'running',
  'review_pending',
  'revision_pending',
  'human_in_loop',
  'approved',
  'archived',
  'delivered',
  'failed'
]);

export const orchestrationReviewSchema = z.object({
  verdict: z.enum(['pass', 'revise', 'escalate']).optional(),
  summary: z.string().min(1),
  reasons: z.array(z.string()).default([])
}).nullable();

export const orchestrationArchiveSchema = z.object({
  versionId: z.string().min(1),
  archivedAt: z.string().datetime(),
  promptFiles: z.array(z.string()).default([])
}).nullable();

export const deliveryOutputSchema = z.object({
  deliveryId: z.string().min(1),
  deliveredAt: z.string().datetime(),
  format: z.enum(['json', 'yaml', 'markdown']).default('json'),
  content: z.record(z.string(), z.unknown()),
  summary: z.string().min(1)
}).nullable();

export const dataFeedbackSchema = z.object({
  feedbackId: z.string().min(1),
  createdAt: z.string().datetime(),
  assetPatches: z.array(z.object({
    target: z.enum(['asset', 'rule', 'prompt']),
    key: z.string().min(1),
    value: z.unknown()
  })).default([]),
  memo: z.string().default('')
}).nullable();

export const orchestrationRunSchema = z.object({
  runId: z.string().min(1),
  status: orchestrationStatusSchema,
  currentNodeId: z.string().min(1).nullable(),
  projectPath: z.string().min(1),
  completedNodes: z.array(z.string()),
  pendingNodes: z.array(z.string()),
  artifacts: z.record(z.string(), z.unknown()),
  review: orchestrationReviewSchema,
  archive: orchestrationArchiveSchema,
  delivery: deliveryOutputSchema.optional().default(null),
  feedback: dataFeedbackSchema.optional().default(null)
});

export const orchestrationNodeConfigSchema = z.object({
  agentId: z.string().min(1),
  // Default to 'typescript': the Python runtime was removed with the Python
  // agent chain (commit 820a969). 'python' stays in the enum only so historic
  // configs still parse and the auto-mode rebuild can reuse the schema — see
  // docs/internal/auto-mode-rebuild-plan.md. No node currently executes Python.
  runtime: z.enum(['typescript', 'python']).default('typescript'),
  entry: z.string().min(1),
  model: z.string().min(1),
  execution: z.object({
    timeoutMs: z.number().int().positive(),
    maxRetries: z.number().int().min(0)
  }),
  prompt: z.object({
    file: z.string().min(1),
    systemKey: z.string().min(1),
    userKey: z.string().min(1)
  }),
  inputs: z.object({
    fromState: z.array(z.string()),
    mappings: z.record(z.string(), z.string())
  }),
  outputs: z.object({
    artifactType: z.string().min(1),
    stateKey: z.string().min(1)
  }),
  review: z.object({
    passRules: z.array(z.string()),
    escalateOn: z.array(z.string())
  })
});

export const orchestrationActionSchema = z.object({
  runId: z.string().min(1),
  action: z.enum(['accept_current', 'edit_and_resume', 'rerun_from_node', 'abort_run']),
  nodeId: z.string().min(1).optional(),
  payload: z.unknown().optional()
});

export const startOrchestrationRunSchema = z.object({
  projectPath: z.string().min(1),
  requirement: z.string().min(1),
  configRoot: z.string().min(1).optional()
});

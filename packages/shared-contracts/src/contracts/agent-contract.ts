import { z } from 'zod';
import { creativeFieldKeySchema } from './creative-fields';
import type { CreativeFieldKey } from './creative-fields';

// ── Creative Constraints ──

export const creativeConstraintsSchema = z.object({
  language: z.enum(['zh-CN', 'en-US']).default('zh-CN'),
  contentRating: z.string().optional(),
  episodeCount: z.number().int().positive().optional(),
  chapterCount: z.number().int().positive().optional(),
  targetLength: z.string().optional()
});

export type CreativeConstraints = z.infer<typeof creativeConstraintsSchema>;

// ── Agent Policy ──

export const agentPolicySchema = z.object({
  outputJsonOnly: z.boolean().default(true),
  noOverwriteOtherFields: z.boolean().default(true),
  noDiscardUpstreamFacts: z.boolean().default(true),
  explicitDegradeOnMissing: z.boolean().default(true),
  traceableSourceRefs: z.boolean().default(true),
  defaultLanguage: z.enum(['zh-CN', 'en-US']).default('zh-CN'),
  fieldNameCase: z.literal('snake_case').default('snake_case')
});

export type AgentPolicy = z.infer<typeof agentPolicySchema>;

// ── Agent Contract ──

export const agentContractSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  goal: z.string().min(1),
  owns: z.array(creativeFieldKeySchema),
  reads: z.array(creativeFieldKeySchema),
  must: z.array(z.string()),
  mustNot: z.array(z.string()),
  outputSchemaName: z.string().min(1),
  qualityGates: z.array(z.string())
});

export type AgentContract = z.infer<typeof agentContractSchema>;

// ── Field Dependency Graph ──

export const fieldDependencyEdgeSchema = z.object({
  upstream: creativeFieldKeySchema,
  downstream: creativeFieldKeySchema
});

export const fieldDependencyGraphSchema = z.object({
  edges: z.array(fieldDependencyEdgeSchema)
});

export type FieldDependencyGraph = z.infer<typeof fieldDependencyGraphSchema>;

// ── Workflow Sync Event ──

export const workflowSyncEventSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  source: z.enum(['user', 'agent', 'sync']),
  field: creativeFieldKeySchema,
  entityId: z.string().optional(),
  fromVersion: z.number().int().nonnegative(),
  toVersion: z.number().int().nonnegative(),
  reason: z.string(),
  affectedFields: z.array(creativeFieldKeySchema)
});

export type WorkflowSyncEvent = z.infer<typeof workflowSyncEventSchema>;

// ── Asset Patch Candidate ──

export const assetPatchCandidateSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['add', 'update', 'deprecate']),
  targetType: z.enum(['asset_card', 'relationship_edge']),
  targetId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  sourceRefs: z.array(z.string()).default([]),
  autoApply: z.boolean().default(false),
  reason: z.string().optional()
});

export type AssetPatchCandidate = z.infer<typeof assetPatchCandidateSchema>;

// ── Creative Run Request ──

export const creativeRunRequestSchema = z.object({
  projectPath: z.string().min(1),
  requirement: z.string().min(1),
  projectDocument: z.record(z.string(), z.unknown()).optional(),
  runIntent: z.enum(['create', 'expand', 'revise', 'review']).default('create'),
  targetFields: z.array(creativeFieldKeySchema).optional(),
  configRoot: z.string().optional(),
  constraints: creativeConstraintsSchema.optional()
});

export type CreativeRunRequest = z.infer<typeof creativeRunRequestSchema>;

// ── Creative Run Context ──

export const creativeRunContextSchema = z.object({
  runId: z.string().min(1),
  projectPath: z.string().min(1),
  requirement: z.string().min(1),
  runIntent: z.enum(['create', 'expand', 'revise', 'review']),
  targetFields: z.array(creativeFieldKeySchema),
  projectDocument: z.record(z.string(), z.unknown()).nullable(),
  projectDocumentStatus: z.enum(['loaded', 'missing', 'partial']).default('missing'),
  fieldVersions: z.record(creativeFieldKeySchema, z.number().int().nonnegative()),
  dependencyGraph: fieldDependencyGraphSchema,
  staleFields: z.array(creativeFieldKeySchema),
  syncEvents: z.array(workflowSyncEventSchema),
  constraints: creativeConstraintsSchema,
  agentPolicy: agentPolicySchema
});

export type CreativeRunContext = z.infer<typeof creativeRunContextSchema>;

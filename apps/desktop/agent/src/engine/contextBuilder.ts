import { creativeFieldKeys, type CreativeFieldKey } from '@orison/shared-contracts';
import { getDefaultDependencyGraph, initFieldVersions } from './workflowSync';

const FIELD_ALIAS: Record<string, CreativeFieldKey> = {
  outline_v2: 'outline',
  outline: 'outline',
  asset_cards: 'asset_cards',
  world_setting: 'world_setting',
  relationship_graph: 'relationship_graph',
  growth_curve: 'growth_curve',
  pacing_curve: 'pacing_curve',
  emotion_curve: 'emotion_curve',
  episode_outlines: 'episode_outlines',
  foreshadow_registry: 'foreshadow_registry',
  creative_brief: 'creative_brief',
};

export function buildCreativeRunContext(request: {
  projectPath: string;
  requirement: string;
  projectDocument?: Record<string, unknown> | null;
  targetFields?: CreativeFieldKey[];
  constraints?: Record<string, unknown>;
}) {
  const runId = `run_${Date.now().toString(36)}`;
  const fieldVersions = initFieldVersions();
  let projectDocumentStatus: 'missing' | 'loaded' | 'partial' = 'missing';

  if (request.projectDocument) {
    let _found = 0;
    for (const [key, val] of Object.entries(request.projectDocument)) {
      if (key === 'meta') continue;
      const mapped = FIELD_ALIAS[key];
      if (mapped && val != null) {
        fieldVersions[mapped] = 1;
        _found++;
      }
    }
    projectDocumentStatus = request.projectDocument.meta ? 'loaded' : 'partial';
  }

  return {
    runId,
    projectPath: request.projectPath,
    requirement: request.requirement,
    runIntent: 'create' as const,
    targetFields: request.targetFields ?? [...creativeFieldKeys],
    projectDocument: request.projectDocument ?? null,
    projectDocumentStatus,
    fieldVersions,
    dependencyGraph: getDefaultDependencyGraph(),
    staleFields: [] as CreativeFieldKey[],
    syncEvents: [],
    constraints: {
      language: 'zh-CN' as const,
      ...(request.constraints ?? {}),
    },
    agentPolicy: {
      outputJsonOnly: true,
      noOverwriteOtherFields: true,
      noDiscardUpstreamFacts: true,
      explicitDegradeOnMissing: true,
      traceableSourceRefs: true,
      defaultLanguage: 'zh-CN' as const,
      fieldNameCase: 'snake_case' as const,
    },
  };
}

import type { WorkflowRunStatus } from '../types';
import type { ArtifactStore } from '../artifact/store';
import type { ArtifactRecord } from '../artifact/types';
import type { ResolvedReferencePayload } from '../skill/runtime/referenceResolver';
import type { SkillRunState } from '../runtime/skillRunState';

export interface BuildSkillContextInput {
  sessionId: string;
  runStatus: WorkflowRunStatus;
  recentSummary?: string;
  requestedArtifactIds?: string[];
  referenceArtifactIds?: string[];
  artifactStore: ArtifactStore;
  resolvedReferences?: ResolvedReferencePayload[];
  referenceCache?: Map<string, ResolvedReferencePayload>;
  skillRunState?: SkillRunState;
}

export interface SkillRuntimeContext {
  runtime: {
    sessionId: string;
    runStatus: WorkflowRunStatus;
  };
  summary: string;
  artifacts: ArtifactRecord[];
  references: ArtifactRecord[];
  resolvedReferences: ResolvedReferencePayload[];
  referenceCache: Map<string, ResolvedReferencePayload>;
  skillRunState?: SkillRunState;
}

export function buildSkillContext(input: BuildSkillContextInput): SkillRuntimeContext {
  return {
    runtime: {
      sessionId: input.sessionId,
      runStatus: input.runStatus,
    },
    summary: input.recentSummary ?? '',
    artifacts: (input.requestedArtifactIds ?? [])
      .map((id) => input.artifactStore.read(id))
      .filter((item): item is ArtifactRecord => Boolean(item)),
    references: (input.referenceArtifactIds ?? [])
      .map((id) => input.artifactStore.read(id))
      .filter((item): item is ArtifactRecord => Boolean(item)),
    resolvedReferences: input.resolvedReferences ?? [],
    referenceCache: input.referenceCache ?? new Map<string, ResolvedReferencePayload>(),
    skillRunState: input.skillRunState,
  };
}

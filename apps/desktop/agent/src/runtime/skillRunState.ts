import type { ResolvedReferencePayload } from '../skill/runtime/referenceResolver';

export interface PendingSkillUserAction {
  type: 'ask_user';
  nodeId: string;
  question: string;
  choices?: string[];
  createdAt: number;
}

export interface SerializedSkillRunState {
  skill: string;
  currentNodeId?: string;
  completedNodeIds: string[];
  loadedReferenceKeys: string[];
  writtenArtifactIds: string[];
  pendingUserAction?: PendingSkillUserAction;
  userResponses?: Record<string, string>;
  resolvedReferences: ResolvedReferencePayload[];
}

export interface SkillRunState extends SerializedSkillRunState {
  referenceCache: Map<string, ResolvedReferencePayload>;
}

export function createSkillRunState(input: {
  skill: string;
  currentNodeId?: string;
  completedNodeIds?: string[];
  loadedReferenceKeys?: string[];
  writtenArtifactIds?: string[];
  pendingUserAction?: PendingSkillUserAction;
  userResponses?: Record<string, string>;
  resolvedReferences?: ResolvedReferencePayload[];
  referenceCache?: Map<string, ResolvedReferencePayload>;
}): SkillRunState {
  const resolvedReferences = [...(input.resolvedReferences ?? [])];
  const referenceCache = input.referenceCache ?? new Map<string, ResolvedReferencePayload>(
    resolvedReferences.map((payload) => [payload.key, payload]),
  );

  return {
    skill: input.skill,
    currentNodeId: input.currentNodeId,
    completedNodeIds: [...(input.completedNodeIds ?? [])],
    loadedReferenceKeys: [...(input.loadedReferenceKeys ?? [])],
    writtenArtifactIds: [...(input.writtenArtifactIds ?? [])],
    pendingUserAction: input.pendingUserAction,
    userResponses: input.userResponses,
    resolvedReferences,
    referenceCache,
  };
}

export function serializeSkillRunState(state?: SkillRunState): SerializedSkillRunState | undefined {
  if (!state) return undefined;
  return {
    skill: state.skill,
    currentNodeId: state.currentNodeId,
    completedNodeIds: [...state.completedNodeIds],
    loadedReferenceKeys: [...state.loadedReferenceKeys],
    writtenArtifactIds: [...state.writtenArtifactIds],
    pendingUserAction: state.pendingUserAction,
    userResponses: state.userResponses,
    resolvedReferences: [...state.resolvedReferences],
  };
}

export function restoreSkillRunState(state?: SerializedSkillRunState): SkillRunState | undefined {
  if (!state) return undefined;
  return createSkillRunState({
    skill: state.skill,
    currentNodeId: state.currentNodeId,
    completedNodeIds: state.completedNodeIds,
    loadedReferenceKeys: state.loadedReferenceKeys,
    writtenArtifactIds: state.writtenArtifactIds,
    pendingUserAction: state.pendingUserAction,
    userResponses: state.userResponses,
    resolvedReferences: state.resolvedReferences,
  });
}

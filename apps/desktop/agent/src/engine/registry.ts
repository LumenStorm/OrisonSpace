import type { AgentContract } from '@orison/shared-contracts';
import { getAgentContract } from './agentContracts';

interface NodeRegistryEntry {
  id: string;
  config: {
    outputs: { stateKey: string; artifactType: string };
    inputs: { fromState: string[] };
  };
  contract: AgentContract | null;
}

const STATE_KEY_MAP: Record<string, string> = {
  'intake-agent': 'creative_brief',
  'asset-loader-agent': 'assets.projectContext',
  'story-planner-agent': 'planning.storyPlan',
  'curve-planner-agent': 'curves',
  'episode-planner-agent': 'episode_outlines',
  'chapter-task-agent': 'chapter_tasks',
  'draft-writer-agent': 'draft.initial',
  'continuity-memory-agent': 'memory.continuity',
  'multi-review-agent': 'review.latest',
  'targeted-revision-agent': 'revision.output',
};

const DEFAULT_CHAIN = [
  'intake-agent',
  'asset-loader-agent',
  'story-planner-agent',
  'chapter-task-agent',
  'draft-writer-agent',
  'continuity-memory-agent',
  'multi-review-agent',
];

const EXTENDED_CHAIN = [
  'intake-agent',
  'asset-loader-agent',
  'story-planner-agent',
  'curve-planner-agent',
  'episode-planner-agent',
  'chapter-task-agent',
  'draft-writer-agent',
  'continuity-memory-agent',
  'multi-review-agent',
];

function buildEntry(id: string): NodeRegistryEntry {
  const contract = getAgentContract(id) ?? null;
  return {
    id,
    config: {
      outputs: { stateKey: STATE_KEY_MAP[id] ?? id, artifactType: id },
      inputs: { fromState: contract?.reads ?? [] },
    },
    contract,
  };
}

export function createNodeRegistry(): NodeRegistryEntry[] {
  return DEFAULT_CHAIN.map(buildEntry);
}

export function createExtendedNodeRegistry(): NodeRegistryEntry[] {
  return EXTENDED_CHAIN.map(buildEntry);
}

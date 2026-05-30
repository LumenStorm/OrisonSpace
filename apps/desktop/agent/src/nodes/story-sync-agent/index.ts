import type { NodeRunInput } from '../../contracts/run';
import { creativeFieldKeys } from '@orison/shared-contracts';
import { deriveStorySyncByRules } from './rules';

const CREATIVE_SET = new Set<string>(creativeFieldKeys);

export function createStorySyncNode() {
  return {
    async run(input: NodeRunInput) {
      const { run } = input;
      const candidate = run.artifacts['chapter.candidate'] as any;
      const context = run.artifacts['context.chapterContext'] as any;

      if (!candidate) {
        return {
          stateKey: 'story.sync',
          artifact: {
            runId: run.runId,
            chapterId: context?.chapterId ?? '',
            summary: 'skip: no chapter candidate',
            patches: [],
          },
        };
      }

      // Try LLM patches first
      const llmPatches = (candidate as any).llmPatches;
      if (llmPatches && Array.isArray(llmPatches)) {
        const allWhitelisted = llmPatches.every(
          (p: any) => p?.field && CREATIVE_SET.has(p.field),
        );
        if (!allWhitelisted) {
          // Fall back to rules
          return rulesPath(run, candidate, context);
        }

        const contextVersions = context?.fieldVersions ?? {};
        const allFresh = llmPatches.every((p: any) => {
          if (!p.field) return false;
          const expected = contextVersions[p.field];
          return expected === undefined || p.fieldVersion === expected;
        });
        if (!allFresh) {
          return rulesPath(run, candidate, context);
        }

        // Use LLM patches, override generatedBy
        const patches = llmPatches.map((p: any) => ({
          ...p,
          generatedBy: 'story-sync-agent',
        }));

        return {
          stateKey: 'story.sync',
          artifact: {
            runId: run.runId,
            chapterId: candidate.chapterId ?? context?.chapterId ?? '',
            summary: `${patches.length} llm patches applied`,
            patches,
          },
        };
      }

      return rulesPath(run, candidate, context);
    },
  };
}

function rulesPath(run: any, candidate: any, context: any) {
  const chapterId = candidate.chapterId ?? context?.chapterId ?? '';
  const result = deriveStorySyncByRules({
    chapterId,
    content: candidate.content ?? '',
    chapterNumber: context?.chapterNumber ?? 0,
    existingForeshadow: context?.foreshadowRegistry ?? { items: [], version: 0 },
    foreshadowVersion: context?.foreshadowRegistry?.version ?? 0,
  });

  return {
    stateKey: 'story.sync',
    artifact: {
      runId: run.runId,
      chapterId,
      summary: `${result.patches.length} patches from rules`,
      patches: result.patches,
    },
  };
}

import type { CreativeFieldKey } from '@orison/shared-contracts';
import { parseStorySyncPatches } from '@orison/story-sync';
import type { OrchestrationNode } from '../base';
import type { NodeRunInput, NodeRunResult } from '../../contracts/run';
import { deriveStorySyncByRules } from './rules';

/**
 * Story Sync Agent (post-migration).
 *
 * Inputs:
 *  - context.chapterContext  (assetCards, foreshadowRegistry, novelTitle, ...)
 *  - chapter.candidate       (title, content, summary, wordCount)
 *  - chapter.llmPatches      (optional, pre-computed by desktop main process)
 *
 * Output: state_key = 'story.sync'
 *  {
 *    runId, chapterId, summary,
 *    patches: ProjectFieldPatch.patches[]
 *  }
 *
 * Behaviour:
 *  - If `artifacts['chapter.llmPatches']` is present, the agent treats it as
 *    untrusted input and re-validates via `parseStorySyncPatches` from
 *    `@orison/story-sync` (whitelist field, action='merge', fieldVersion
 *    matches context, generatedBy forced to 'story-sync-agent').
 *  - If validation succeeds and yields patches, the agent emits those.
 *  - On validation failure or absent field, the agent falls back to the
 *    rules path (`deriveStorySyncByRules`).
 *  - The agent never opens an outbound HTTPS connection to a model provider
 *    and never holds an apiKey.
 */
export type StorySyncDeps = Record<string, never>;

export function createStorySyncNode(_deps: StorySyncDeps = {}): OrchestrationNode {
  return {
    id: 'story-sync-agent',
    contract: {
      nodeId: 'story-sync-agent',
      displayName: 'Story Sync Agent',
      inputSchemaName: 'chapterContextAndCandidate',
      outputSchemaName: 'novelStorySyncPayload',
      requiredArtifactKeys: ['context.chapterContext', 'chapter.candidate'],
      producedArtifactKeys: ['story.sync'],
      sideEffects: ['persist_artifact'],
    },
    async run(input: NodeRunInput): Promise<NodeRunResult> {
      const ctx = input.run.artifacts?.['context.chapterContext'] as Record<string, any> | undefined;
      const candidate = input.run.artifacts?.['chapter.candidate'] as Record<string, any> | undefined;
      const llmPatches = input.run.artifacts?.['chapter.llmPatches'];
      const runId = input.run.runId;

      if (!candidate || !candidate.content) {
        return {
          stateKey: 'story.sync',
          artifact: {
            runId,
            chapterId: ctx?.chapterId ?? '',
            patches: [],
            summary: 'skip: no chapter candidate available',
          },
        };
      }

      const chapterId = (candidate.chapterId as string) ?? (ctx?.chapterId as string) ?? '';
      const content = (candidate.content as string) ?? '';
      const existingForeshadow = (ctx?.foreshadowRegistry?.items ?? []) as Array<Record<string, any>>;
      const foreshadowVersion =
        typeof ctx?.foreshadowRegistry?.version === 'number'
          ? (ctx.foreshadowRegistry.version as number)
          : 0;

      const fieldVersions = collectFieldVersions(ctx);

      // ── Pre-computed LLM patches path ──
      if (llmPatches !== undefined) {
        const validated = parseStorySyncPatches(llmPatches, {
          runId,
          chapterId,
          fieldVersions,
        });
        if (validated.ok && validated.payload.patches.length > 0) {
          return {
            stateKey: 'story.sync',
            artifact: {
              runId,
              chapterId,
              patches: validated.payload.patches,
              summary: validated.payload.summary,
            },
          };
        }
        // Validation failed (or yielded zero patches) — fall through to rules.
      }

      // ── Rules fallback ──
      const { patches } = deriveStorySyncByRules({
        chapterId,
        content,
        chapterNumber: ctx?.chapterNumber,
        existingForeshadow,
        foreshadowVersion,
      });

      const summary =
        patches.length === 0
          ? 'no field updates derived from chapter candidate'
          : `derived ${patches.length} field patch(es) from chapter ${chapterId || '(unknown)'}`;

      return {
        stateKey: 'story.sync',
        artifact: { runId, chapterId, patches, summary },
      };
    },
  };
}

function collectFieldVersions(ctx: Record<string, any> | undefined): Partial<Record<CreativeFieldKey, number>> {
  const v: Partial<Record<CreativeFieldKey, number>> = {};
  if (!ctx) return v;
  const pick = (key: CreativeFieldKey, source: any) => {
    if (typeof source?.version === 'number') v[key] = source.version;
  };
  pick('foreshadow_registry', ctx.foreshadowRegistry);
  pick('relationship_graph', ctx.relationshipGraph);
  pick('asset_cards', ctx.assetCards);
  pick('world_setting', ctx.worldSetting);
  pick('outline', ctx.outline);
  pick('episode_outlines', ctx.episodeOutlines);
  pick('growth_curve', ctx.growthCurve);
  pick('pacing_curve', ctx.pacingCurve);
  pick('emotion_curve', ctx.emotionCurve);
  pick('creative_brief', ctx.creativeBrief);
  return v;
}

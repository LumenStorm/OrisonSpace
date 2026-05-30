import { createRunService } from './runService';
import { createStorySyncNode, createMemoryExtractorNode } from '../nodes/base';
import { addMemoryEntry } from '@orison/desktop-local-bff';

export async function runNovelPipeline(input: { projectPath: string; chapterId: string; mode: string }) {
  const service = createRunService();
  const run = await service.startNovelChapter({
    projectPath: input.projectPath,
    chapterId: input.chapterId,
    mode: input.mode as any,
  });

  const syncNode = createStorySyncNode();
  const memNode = createMemoryExtractorNode();

  const nodeInput = {
    run: {
      runId: run.runId,
      status: run.status,
      currentNodeId: run.currentNodeId,
      projectPath: input.projectPath,
      completedNodes: run.completedNodes,
      pendingNodes: [],
      artifacts: run.artifacts,
      review: run.review,
      archive: run.archive,
      delivery: run.delivery,
      feedback: run.feedback,
    },
    requirement: '',
  };

  const syncResult = await syncNode.run(nodeInput);
  run.artifacts[syncResult.stateKey] = syncResult.artifact;
  run.completedNodes.push('story-sync-agent');

  const memResult = await memNode.run(nodeInput);
  run.artifacts[memResult.stateKey] = memResult.artifact;
  run.completedNodes.push('memory-extractor-agent');

  // Persist extracted memories to YAML
  const extracted = memResult.artifact as any;
  if (extracted?.entries?.length) {
    for (const entry of extracted.entries) {
      addMemoryEntry(input.projectPath, entry);
    }
  }

  return run;
}

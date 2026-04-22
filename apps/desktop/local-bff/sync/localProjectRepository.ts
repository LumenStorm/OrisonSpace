import type { z } from 'zod';
import { patchOperationSchema, projectDocumentSchema } from '@orison/shared-contracts';

type ProjectDocument = z.infer<typeof projectDocumentSchema>;
type PatchOperation = z.infer<typeof patchOperationSchema>;

export function createEmptyProjectDocument(name: string): ProjectDocument {
  return projectDocumentSchema.parse({
    meta: {
      id: crypto.randomUUID(),
      name,
      version: 1
    },
    story: {
      title: name,
      acts: []
    },
    script: {
      scenes: []
    },
    storyboard: {
      shots: []
    }
  });
}

export function applyPatchOperations(project: ProjectDocument, operations: PatchOperation[]) {
  const next = structuredClone(project) as Record<string, any>;

  for (const operation of operations) {
    if (operation.op !== 'replace') {
      continue;
    }

    if (operation.path === 'story.acts[0].summary' && next.story.acts[0]) {
      next.story.acts[0].summary = operation.value;
    }
  }

  next.meta.version += 1;
  return projectDocumentSchema.parse(next);
}

import type { z } from 'zod';
import { patchOperationSchema, projectDocumentSchema } from '@orison/shared-contracts';

type ProjectDocument = z.infer<typeof projectDocumentSchema>;
type PatchOperation = z.infer<typeof patchOperationSchema>;

export function createEmptyProjectDocument(name: string, type: 'novel' | 'script' = 'novel'): ProjectDocument {
  const now = new Date().toISOString();
  return projectDocumentSchema.parse({
    meta: {
      id: crypto.randomUUID(),
      name,
      type,
      version: 1,
      created_at: now,
      updated_at: now
    },
    outline: {
      title: name,
      acts: []
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

    if (operation.path === 'outline.acts[0].summary' && next.outline.acts[0]) {
      next.outline.acts[0].summary = operation.value;
    }
  }

  next.meta.version += 1;
  next.meta.updated_at = new Date().toISOString();
  return projectDocumentSchema.parse(next);
}

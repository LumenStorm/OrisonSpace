/**
 * Outline tool handlers — outline_read, outline_update.
 *
 * outline_read returns the structured outline (outline_v2) from project.yaml,
 * parsed via local-bff's loadProject (single source of truth — the shell has
 * no direct yaml dependency).
 *
 * outline_update does NOT write to disk — it returns a `field_patch` metadata
 * envelope so the UI can surface the change in the patch-review flow (mirrors
 * rewrite_passage). The user accepts/rejects; acceptance persists via syncField.
 */
import type { ToolHandler } from './types';

async function readOutlineV2(projectDir: string): Promise<unknown> {
  try {
    const { loadProject } = await import('@orison/desktop-local-bff');
    const doc = loadProject(projectDir) as Record<string, unknown> | null;
    return doc?.outline_v2 ?? null;
  } catch {
    return null;
  }
}

export const outlineReadHandler: ToolHandler = async ({ projectDir }) => {
  const outline = await readOutlineV2(projectDir);
  if (outline == null) {
    return { title: 'outline_read', output: 'No outline found in project.yaml (outline_v2 is empty).' };
  }
  return { title: 'outline_read', output: JSON.stringify(outline, null, 2) };
};

export const outlineUpdateHandler: ToolHandler = async ({ params }) => {
  const { outline } = params as { outline: unknown };
  const phaseCount = Array.isArray((outline as { phases?: unknown[] })?.phases)
    ? (outline as { phases: unknown[] }).phases.length
    : 0;
  return {
    title: 'outline_update',
    output: `Outline update prepared (${phaseCount} phase(s)). Awaiting user review in the outline panel.`,
    metadata: {
      type: 'field_patch',
      field: 'outline',
      action: 'set',
      data: outline,
    },
  };
};

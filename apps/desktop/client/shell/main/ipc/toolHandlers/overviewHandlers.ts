/**
 * Overview tool handler — overview_update.
 *
 * Proposes an update to project meta (title/logline/synopsis/genre/theme/tone).
 * Does NOT write to disk — returns a `field_patch` metadata envelope (field
 * 'overview') for the UI patch-review flow. On accept, the UI persists via
 * syncProjectMeta (project.json + project.yaml), avoiding a dual-source drift.
 */
import type { ToolHandler } from '../toolExecution';

const OVERVIEW_KEYS = ['name', 'logline', 'synopsis', 'genre', 'theme', 'tone'] as const;

export const overviewUpdateHandler: ToolHandler = async ({ params }) => {
  const src = params as Record<string, unknown>;
  const data: Record<string, string> = {};
  for (const key of OVERVIEW_KEYS) {
    const value = src[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      data[key] = value;
    }
  }

  const changed = Object.keys(data);
  if (changed.length === 0) {
    return {
      title: 'overview_update',
      output: 'No overview fields provided. Nothing to update.',
    };
  }

  return {
    title: 'overview_update',
    output: `Overview update prepared (${changed.join(', ')}). Awaiting user review on the Overview page.`,
    metadata: {
      type: 'field_patch',
      field: 'overview',
      action: 'set',
      data,
    },
  };
};

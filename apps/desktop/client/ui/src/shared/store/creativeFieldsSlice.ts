import type { StateCreator } from 'zustand';
import type { z } from 'zod';
import type {
  CreativeFieldKey,
  fieldMetadataSchema,
  projectFieldPatchSchema,
  projectDocumentSchema
} from '@orison/shared-contracts';
import { creativeFieldKeys } from '@orison/shared-contracts';
import type { ProjectMeta } from './types';
import { useToastStore } from './toastStore';
import { translate } from '../i18n/useI18n';
import { registerProjectReset } from './resetRegistry';

/** Surface a field-sync failure instead of swallowing it (was `.catch(()=>{})`). */
function reportSyncFailure(locale: string, field: CreativeFieldKey, err: unknown): void {
  const reason = err instanceof Error ? err.message : String(err);
  useToastStore.getState().showToast(translate(locale, 'creative.field.syncFailed', { field, reason }), 'error');
}

type FieldMetadata = z.infer<typeof fieldMetadataSchema>;
type ProjectFieldPatch = z.infer<typeof projectFieldPatchSchema>;
type ProjectDocument = z.infer<typeof projectDocumentSchema>;

export type CreativeFieldsSlice = {
  creativeFields: Partial<Record<CreativeFieldKey, unknown>>;
  fieldMetadata: Partial<Record<CreativeFieldKey, FieldMetadata>>;
  activeCreativeTab: CreativeFieldKey;
  pendingPatch: ProjectFieldPatch | null;
  patchSelections: Record<string, boolean>;
  fieldUndoStack: Array<{ field: CreativeFieldKey; data: unknown }>;
  fieldRedoStack: Array<{ field: CreativeFieldKey; data: unknown }>;

  setActiveCreativeTab: (tab: CreativeFieldKey) => void;
  loadCreativeFields: (doc: ProjectDocument) => void;
  updateField: (field: CreativeFieldKey, data: unknown) => void;
  undoField: () => void;
  redoField: () => void;
  canUndoField: () => boolean;
  canRedoField: () => boolean;
  toggleFieldLock: (field: CreativeFieldKey) => void;
  setPendingPatch: (patch: ProjectFieldPatch | null) => void;
  togglePatchSelection: (field: string) => void;
  applySelectedPatches: () => ProjectFieldPatch | null;
};

const DEFAULT_METADATA: FieldMetadata = {
  version: 0,
  source: 'user',
  locked: false,
  dependsOn: [],
  stale: false
};

export const createCreativeFieldsSlice: StateCreator<
  CreativeFieldsSlice & {
    currentProject: ProjectMeta | null;
    saveProject: () => Promise<void>;
  },
  [],
  [],
  CreativeFieldsSlice
> = (set, get) => {
  // Creative fields + their metadata + any in-flight patch review belong to the
  // current project. Clear them on switch; projectSubscription re-hydrates from
  // the new project's project.yaml.
  registerProjectReset(() => {
    set({ creativeFields: {}, fieldMetadata: {}, pendingPatch: null, patchSelections: {}, fieldUndoStack: [], fieldRedoStack: [] });
  });

  return {
  creativeFields: {},
  fieldMetadata: {},
  activeCreativeTab: 'world_setting',
  pendingPatch: null,
  patchSelections: {},
  fieldUndoStack: [],
  fieldRedoStack: [],

  setActiveCreativeTab: (tab) => set({ activeCreativeTab: tab }),

  loadCreativeFields: (doc) => {
    const fields: Partial<Record<CreativeFieldKey, unknown>> = {};
    for (const key of creativeFieldKeys) {
      // Map creative field key 'outline' → document key 'outline_v2'.
      // The old 'outline' schema in projectDocumentSchema is deprecated;
      // all new data uses outline_v2. See project.ts for details.
      const docKey = key === 'outline' ? 'outline_v2' : key;
      const value = (doc as Record<string, unknown>)[docKey];
      if (value !== undefined) {
        fields[key] = value;
      }
    }
    set({
      creativeFields: fields,
      fieldMetadata: doc.field_metadata ?? {}
    });
  },

  updateField: (field, data) => {
    const { creativeFields, fieldMetadata, fieldUndoStack, currentProject } = get();
    const previousData = creativeFields[field];
    const meta = fieldMetadata[field] ?? { ...DEFAULT_METADATA };
    set({
      creativeFields: { ...creativeFields, [field]: data },
      fieldMetadata: {
        ...fieldMetadata,
        [field]: { ...meta, version: meta.version + 1, source: 'user', stale: false }
      },
      fieldUndoStack: [...fieldUndoStack.slice(-29), { field, data: previousData }],
      fieldRedoStack: [],
    });
    if (currentProject?.path && window.orisonDesktop?.syncField) {
      const locale = (get() as any).resolvedLocale ?? 'en-US';
      window.orisonDesktop.syncField(currentProject.path, field, data).catch((err) => reportSyncFailure(locale, field, err));
    }
  },

  undoField: () => {
    const { fieldUndoStack, fieldRedoStack, creativeFields, fieldMetadata, currentProject } = get();
    if (fieldUndoStack.length === 0) return;
    const entry = fieldUndoStack[fieldUndoStack.length - 1];
    const currentData = creativeFields[entry.field];
    const meta = fieldMetadata[entry.field] ?? { ...DEFAULT_METADATA };
    set({
      creativeFields: { ...creativeFields, [entry.field]: entry.data },
      fieldMetadata: {
        ...fieldMetadata,
        [entry.field]: { ...meta, version: meta.version + 1, source: 'user', stale: false }
      },
      fieldUndoStack: fieldUndoStack.slice(0, -1),
      fieldRedoStack: [...fieldRedoStack, { field: entry.field, data: currentData }],
    });
    if (currentProject?.path && window.orisonDesktop?.syncField) {
      const locale = (get() as any).resolvedLocale ?? 'en-US';
      window.orisonDesktop.syncField(currentProject.path, entry.field, entry.data).catch((err) => reportSyncFailure(locale, entry.field, err));
    }
  },

  redoField: () => {
    const { fieldUndoStack, fieldRedoStack, creativeFields, fieldMetadata, currentProject } = get();
    if (fieldRedoStack.length === 0) return;
    const entry = fieldRedoStack[fieldRedoStack.length - 1];
    const currentData = creativeFields[entry.field];
    const meta = fieldMetadata[entry.field] ?? { ...DEFAULT_METADATA };
    set({
      creativeFields: { ...creativeFields, [entry.field]: entry.data },
      fieldMetadata: {
        ...fieldMetadata,
        [entry.field]: { ...meta, version: meta.version + 1, source: 'user', stale: false }
      },
      fieldUndoStack: [...fieldUndoStack, { field: entry.field, data: currentData }],
      fieldRedoStack: fieldRedoStack.slice(0, -1),
    });
    if (currentProject?.path && window.orisonDesktop?.syncField) {
      const locale = (get() as any).resolvedLocale ?? 'en-US';
      window.orisonDesktop.syncField(currentProject.path, entry.field, entry.data).catch((err) => reportSyncFailure(locale, entry.field, err));
    }
  },

  canUndoField: () => get().fieldUndoStack.length > 0,
  canRedoField: () => get().fieldRedoStack.length > 0,

  toggleFieldLock: (field) => {
    const { fieldMetadata } = get();
    const meta = fieldMetadata[field] ?? { ...DEFAULT_METADATA };
    set({
      fieldMetadata: {
        ...fieldMetadata,
        [field]: { ...meta, locked: !meta.locked }
      }
    });
  },

  setPendingPatch: (patch) => {
    if (!patch) {
      set({ pendingPatch: null, patchSelections: {} });
      return;
    }
    const selections: Record<string, boolean> = {};
    for (const entry of patch.patches) {
      selections[entry.field] = true;
    }
    set({ pendingPatch: patch, patchSelections: selections });
  },

  togglePatchSelection: (field) => {
    const { patchSelections } = get();
    set({
      patchSelections: { ...patchSelections, [field]: !patchSelections[field] }
    });
  },

  applySelectedPatches: () => {
    const { pendingPatch, patchSelections, creativeFields, fieldMetadata, currentProject } = get();
    if (!pendingPatch) return null;

    const selectedPatches = pendingPatch.patches.filter((p) => patchSelections[p.field]);
    if (selectedPatches.length === 0) {
      set({ pendingPatch: null, patchSelections: {} });
      return null;
    }

    const nextFields = { ...creativeFields };
    const nextMeta = { ...fieldMetadata };
    let overviewData: Record<string, unknown> | null = null;

    for (const patch of selectedPatches) {
      // 'overview' targets project meta (name/logline/synopsis…), not a
      // creative field — persisted separately via saveProject below.
      if (patch.field === 'overview') {
        if (patch.action !== 'delete' && patch.data && typeof patch.data === 'object') {
          overviewData = patch.data as Record<string, unknown>;
        }
        continue;
      }
      const key = patch.field as CreativeFieldKey;
      if (patch.action === 'delete') {
        delete nextFields[key];
      } else {
        nextFields[key] = patch.data;
      }
      const existing = nextMeta[key] ?? { ...DEFAULT_METADATA };
      nextMeta[key] = {
        ...existing,
        version: patch.fieldVersion,
        source: 'agent',
        stale: false
      };
    }

    const appliedPatch: ProjectFieldPatch = {
      runId: pendingPatch.runId,
      createdAt: pendingPatch.createdAt,
      patches: selectedPatches
    };

    set({
      creativeFields: nextFields,
      fieldMetadata: nextMeta,
      pendingPatch: null,
      patchSelections: {},
      ...(overviewData && currentProject
        ? { currentProject: mergeOverviewIntoProject(currentProject, overviewData) }
        : {})
    });

    // Persist to disk. Creative fields → fieldSyncBridge (project.yaml, with
    // version/lock checks). Overview → saveProject (project.json + .yaml).
    const path = currentProject?.path;
    if (path && window.orisonDesktop?.syncField) {
      const locale = (get() as any).resolvedLocale ?? 'en-US';
      for (const patch of selectedPatches) {
        if (patch.field === 'overview' || patch.action === 'delete') continue;
        window.orisonDesktop.syncField(path, patch.field as CreativeFieldKey, patch.data).catch((err) => reportSyncFailure(locale, patch.field as CreativeFieldKey, err));
      }
    }
    if (overviewData) {
      const locale = (get() as any).resolvedLocale ?? 'en-US';
      get().saveProject().catch((err) => {
        const reason = err instanceof Error ? err.message : String(err);
        useToastStore.getState().showToast(translate(locale, 'creative.field.syncFailed', { field: 'overview', reason }), 'error');
      });
    }

    return appliedPatch;
  }
  };
};

/**
 * Map an agent overview patch (snake_case meta subset) onto the camelCased
 * ProjectMeta the store holds. Only known fields are copied; unknown keys are
 * ignored so a stray field can't corrupt project state.
 */
function mergeOverviewIntoProject(
  project: ProjectMeta,
  data: Record<string, unknown>
): ProjectMeta {
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  return {
    ...project,
    name: str(data.name) ?? project.name,
    logline: str(data.logline) ?? project.logline,
    synopsis: str(data.synopsis) ?? project.synopsis,
    genre: str(data.genre) ?? project.genre,
    theme: str(data.theme) ?? project.theme,
    writingStyle: str(data.writing_style) ?? project.writingStyle,
    tone: str(data.tone) ?? project.tone
  };
}

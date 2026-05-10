import type { StateCreator } from 'zustand';
import type { z } from 'zod';
import type {
  CreativeFieldKey,
  fieldMetadataSchema,
  projectFieldPatchSchema,
  projectDocumentSchema
} from '@orison/shared-contracts';
import { creativeFieldKeys } from '@orison/shared-contracts';

type FieldMetadata = z.infer<typeof fieldMetadataSchema>;
type ProjectFieldPatch = z.infer<typeof projectFieldPatchSchema>;
type ProjectDocument = z.infer<typeof projectDocumentSchema>;

export type CreativeFieldsSlice = {
  creativeFields: Partial<Record<CreativeFieldKey, unknown>>;
  fieldMetadata: Partial<Record<CreativeFieldKey, FieldMetadata>>;
  activeCreativeTab: CreativeFieldKey;
  assetArchiveTarget: { assetId: string; mode: 'primary' | 'gallery' } | null;
  pendingPatch: ProjectFieldPatch | null;
  patchSelections: Record<string, boolean>;

  setActiveCreativeTab: (tab: CreativeFieldKey) => void;
  setAssetArchiveTarget: (target: { assetId: string; mode: 'primary' | 'gallery' } | null) => void;
  loadCreativeFields: (doc: ProjectDocument) => void;
  updateField: (field: CreativeFieldKey, data: unknown) => void;
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
  CreativeFieldsSlice & { currentProject: { path?: string } | null },
  [],
  [],
  CreativeFieldsSlice
> = (set, get) => ({
  creativeFields: {},
  fieldMetadata: {},
  activeCreativeTab: 'world_setting',
  assetArchiveTarget: null,
  pendingPatch: null,
  patchSelections: {},

  setActiveCreativeTab: (tab) => set({ activeCreativeTab: tab }),
  setAssetArchiveTarget: (target) => set({ assetArchiveTarget: target }),

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
    const { creativeFields, fieldMetadata, currentProject } = get();
    const meta = fieldMetadata[field] ?? { ...DEFAULT_METADATA };
    set({
      creativeFields: { ...creativeFields, [field]: data },
      fieldMetadata: {
        ...fieldMetadata,
        [field]: { ...meta, version: meta.version + 1, source: 'user', stale: false }
      }
    });
    // 持久化到磁盘：通过 IPC 调用 local-bff 的 fieldSyncBridge.onFieldEdited
    if (currentProject?.path && window.orisonDesktop?.syncField) {
      window.orisonDesktop.syncField(currentProject.path, field, data).catch(() => {});
    }
  },

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
    const { pendingPatch, patchSelections, creativeFields, fieldMetadata } = get();
    if (!pendingPatch) return null;

    const selectedPatches = pendingPatch.patches.filter((p) => patchSelections[p.field]);
    if (selectedPatches.length === 0) {
      set({ pendingPatch: null, patchSelections: {} });
      return null;
    }

    const nextFields = { ...creativeFields };
    const nextMeta = { ...fieldMetadata };

    for (const patch of selectedPatches) {
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
      patchSelections: {}
    });

    return appliedPatch;
  }
});

import type { StateCreator } from 'zustand';
import type { ModelRef } from '@orison/shared-contracts';
import { storage } from './storage';
import { registerProjectReset } from './resetRegistry';
import {
  defaultParamsFor,
  detectImageFamily,
  IMAGE_FAMILIES,
  parseSizeString,
  sanitizeParams,
  supportsCustomSize,
  type ImageFamily,
  type ImageGenParams,
} from '../imageGen/schema';

const STORAGE_KEY = 'imageGenParams';
const DEBOUNCE_MS = 200;

/**
 * Persisted shape v2 adds `customSize: boolean`. v1 entries are migrated by
 * deriving the flag from whether `params.size` is a non-preset `WxH` string.
 */
type PersistedShape = {
  family: ImageFamily;
  params: ImageGenParams;
  customSize: boolean;
  version: 2;
};

function readPersisted(): PersistedShape | null {
  const raw = storage.get<unknown>(STORAGE_KEY, null);
  if (!raw || typeof raw !== 'object') return null;
  // Loose shape so we can read both v1 and v2 entries without TypeScript
  // collapsing the version field to `never` via intersection.
  const candidate = raw as {
    version?: number;
    family?: ImageFamily;
    params?: ImageGenParams;
    customSize?: boolean;
  };
  if (candidate.version !== 1 && candidate.version !== 2) return null;
  if (!candidate.family || !candidate.params) return null;

  const family: ImageFamily = candidate.family in IMAGE_FAMILIES ? candidate.family : 'fallback';
  // Belt-and-braces: re-sanitize on read so an upgrade that changed allowed
  // values cannot resurrect a stale field.
  const params = sanitizeParams(candidate.params, family);

  // Derive customSize: explicitly persisted (v2) OR inferred (v1) from whether
  // `size` is a syntactically valid WxH that's not a preset.
  let customSize: boolean;
  if (candidate.version === 2 && typeof candidate.customSize === 'boolean') {
    customSize = candidate.customSize;
  } else {
    const presets = IMAGE_FAMILIES[family].size.options;
    customSize =
      supportsCustomSize(family) && !presets.includes(params.size) && parseSizeString(params.size) !== null;
  }
  // Defense: if the family doesn't support custom but the flag is true, force
  // it false. (Migration from one family to another may leave a stale flag.)
  if (!supportsCustomSize(family)) customSize = false;

  return { version: 2, family, params, customSize };
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
function persist(snapshot: PersistedShape): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    storage.set(STORAGE_KEY, snapshot);
  }, DEBOUNCE_MS);
}

const initialPersisted = readPersisted();
const INITIAL_FAMILY: ImageFamily = initialPersisted?.family ?? 'gpt-image-2';
const INITIAL_PARAMS: ImageGenParams = initialPersisted?.params ?? defaultParamsFor(INITIAL_FAMILY);
const INITIAL_CUSTOM_SIZE = initialPersisted?.customSize ?? false;

export type ImageGenSlice = {
  /** Cached family. Derived from selected image model string. */
  imageGenFamily: ImageFamily;
  imageGenParams: ImageGenParams;
  /** User-selected image model ref. Persisted in localStorage. */
  selectedImageRef: ModelRef | null;
  setSelectedImageRef: (ref: ModelRef | null) => void;
  /**
   * UI flag indicating the user picked "custom..." in the size dropdown.
   * Always `false` when the active family does not support custom sizes.
   */
  imageGenCustomSize: boolean;
  /**
   * Reconcile params for a (possibly new) model string. Should be called
   * whenever `modelConfig.selected.image` changes, or whenever the slot's
   * profile.model string changes underneath an unchanged selection.
   */
  reconcileImageGenForModel: (model: string | null | undefined) => void;
  setImageGenParam: <K extends keyof ImageGenParams>(key: K, value: ImageGenParams[K]) => void;
  /**
   * Toggle the custom-size UI mode. When enabling, the existing `params.size`
   * (which may already be a `WxH` string) stays as-is. When disabling, falls
   * back to the family's default preset.
   */
  setImageGenCustomSize: (custom: boolean) => void;
  /**
   * Update both width and height atomically, formatting them into the canonical
   * `${w}x${h}` size string. Implies custom-size mode is on.
   */
  setImageGenCustomDimensions: (width: number, height: number) => void;
  resetImageGenParams: () => void;

  /** Persisted prompt text — survives page switches. */
  imageGenPrompt: string;
  setImageGenPrompt: (prompt: string) => void;

  /** Lightweight result metadata (no b64). Survives page switches. */
  imageGenResultsMeta: ImageGenResultMeta[];
  prependImageGenResults: (items: ImageGenResultMeta[]) => void;
  markResultAsset: (id: string) => void;
  clearImageGenResults: () => void;
};

export type ImageGenResultMeta = {
  id: string;
  prompt: string;
  tempRelativePath: string;
  mimeType: string;
  assetAdded: boolean;
  source: 'generated' | 'loaded' | 'edited';
};

export const createImageGenSlice: StateCreator<ImageGenSlice, [], [], ImageGenSlice> = (set, get) => {
  // The prompt and result gallery are per-project content. They persist to a
  // global localStorage key, so without a reset project A's generations would
  // show in project B's gallery. Clear in-memory + storage on switch; the
  // ImageGenEditor re-hydrates the gallery from the new project's temp dir.
  registerProjectReset(() => {
    set({ imageGenPrompt: '', imageGenResultsMeta: [] });
    storage.set('imageGenPrompt', '');
    storage.set('imageGenResultsMeta', []);
  });

  return {
  imageGenFamily: INITIAL_FAMILY,
  imageGenParams: INITIAL_PARAMS,
  imageGenCustomSize: INITIAL_CUSTOM_SIZE,
  selectedImageRef: storage.get<ModelRef | null>('selectedImageRef', null),

  setSelectedImageRef(ref) {
    set({ selectedImageRef: ref });
    storage.set('selectedImageRef', ref);
    get().reconcileImageGenForModel(ref?.modelId ?? null);
  },

  reconcileImageGenForModel(model) {
    const nextFamily = detectImageFamily(model);
    const current = get();
    if (current.imageGenFamily === nextFamily) {
      // Family unchanged — nothing to sanitize. Still persist on first call so
      // an empty localStorage entry gets seeded.
      persist({
        version: 2,
        family: current.imageGenFamily,
        params: current.imageGenParams,
        customSize: current.imageGenCustomSize,
      });
      return;
    }
    const nextParams = sanitizeParams(current.imageGenParams, nextFamily);
    // Preserve the custom-size flag only if the new family supports it AND
    // the sanitized size is still a custom WxH (not a preset). Otherwise
    // reset to dropdown mode.
    const newFamilySpec = IMAGE_FAMILIES[nextFamily];
    const sizeIsCustom =
      supportsCustomSize(nextFamily) &&
      !newFamilySpec.size.options.includes(nextParams.size) &&
      parseSizeString(nextParams.size) !== null;
    const nextCustomSize = current.imageGenCustomSize && sizeIsCustom;

    set({
      imageGenFamily: nextFamily,
      imageGenParams: nextParams,
      imageGenCustomSize: nextCustomSize,
    });
    persist({ version: 2, family: nextFamily, params: nextParams, customSize: nextCustomSize });
  },

  setImageGenParam(key, value) {
    const current = get();
    const nextParams: ImageGenParams = { ...current.imageGenParams, [key]: value };
    // If `size` is being set to a known preset, exit custom-size mode.
    let nextCustomSize = current.imageGenCustomSize;
    if (key === 'size') {
      const presets = IMAGE_FAMILIES[current.imageGenFamily].size.options;
      if (presets.includes(value as string)) nextCustomSize = false;
    }
    // (outputFormat → compression is preserved in state; payload-level
    // filtering happens in paramsToRequestPayload.)
    set({ imageGenParams: nextParams, imageGenCustomSize: nextCustomSize });
    persist({
      version: 2,
      family: current.imageGenFamily,
      params: nextParams,
      customSize: nextCustomSize,
    });
  },

  setImageGenCustomSize(custom) {
    const current = get();
    if (custom && !supportsCustomSize(current.imageGenFamily)) return;
    if (current.imageGenCustomSize === custom) return;

    let nextParams = current.imageGenParams;
    if (!custom) {
      // Disabling custom mode → fall back to the family default preset to keep
      // the dropdown selection coherent.
      const defaults = defaultParamsFor(current.imageGenFamily);
      nextParams = { ...current.imageGenParams, size: defaults.size };
    }

    set({ imageGenCustomSize: custom, imageGenParams: nextParams });
    persist({
      version: 2,
      family: current.imageGenFamily,
      params: nextParams,
      customSize: custom,
    });
  },

  setImageGenCustomDimensions(width, height) {
    const current = get();
    if (!supportsCustomSize(current.imageGenFamily)) return;

    const w = Math.max(1, Math.floor(Number.isFinite(width) ? width : 0));
    const h = Math.max(1, Math.floor(Number.isFinite(height) ? height : 0));
    const sizeString = `${w}x${h}`;
    const nextParams: ImageGenParams = { ...current.imageGenParams, size: sizeString };
    set({ imageGenParams: nextParams, imageGenCustomSize: true });
    persist({
      version: 2,
      family: current.imageGenFamily,
      params: nextParams,
      customSize: true,
    });
  },

  resetImageGenParams() {
    const current = get();
    const nextParams = defaultParamsFor(current.imageGenFamily);
    set({ imageGenParams: nextParams, imageGenCustomSize: false });
    persist({
      version: 2,
      family: current.imageGenFamily,
      params: nextParams,
      customSize: false,
    });
  },

  imageGenPrompt: storage.get<string>('imageGenPrompt', ''),
  setImageGenPrompt(prompt) {
    set({ imageGenPrompt: prompt });
    storage.set('imageGenPrompt', prompt);
  },

  imageGenResultsMeta: storage.get<ImageGenResultMeta[]>('imageGenResultsMeta', []),
  prependImageGenResults(items) {
    const merged = [...items, ...get().imageGenResultsMeta].slice(0, 200);
    set({ imageGenResultsMeta: merged });
    storage.set('imageGenResultsMeta', merged);
  },
  markResultAsset(id) {
    const updated = get().imageGenResultsMeta.map((r) =>
      r.id === id ? { ...r, assetAdded: true } : r,
    );
    set({ imageGenResultsMeta: updated });
    storage.set('imageGenResultsMeta', updated);
  },
  clearImageGenResults() {
    set({ imageGenResultsMeta: [] });
    storage.set('imageGenResultsMeta', []);
  },
  };
};

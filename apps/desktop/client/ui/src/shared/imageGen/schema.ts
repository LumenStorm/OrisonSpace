/**
 * Image-generation parameter schema, organized by model family.
 *
 * Each family declares which fields it surfaces (`fields`), which size /
 * quality / etc. enums apply, and the default value to fall back to when a
 * field is unsupported by the previously-selected family.
 *
 * Families currently modeled as first-class:
 *   - `gpt-image-2` — newest OpenAI image model. Adds 4K / common 16:9 presets,
 *     custom resolutions, drops `transparent` background, drops `input_fidelity`.
 *   - `gpt-image-1` — previous OpenAI image model. Same OpenAI flags but
 *     supports `transparent` background and only the original 3 size presets.
 *   - `fallback` — minimum common denominator for everything else (dall-e-*,
 *     third-party OpenAI-compatible endpoints). Future iterations can promote
 *     `gpt-image-1.5`, `dall-e-3`, etc. to dedicated rows.
 */

export type ImageFamily = 'gpt-image-2' | 'gpt-image-1' | 'fallback';

export type ImageQuality = 'auto' | 'low' | 'medium' | 'high';
export type ImageBackground = 'transparent' | 'opaque' | 'auto';
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';
export type ImageModeration = 'low' | 'auto';

export type ImageGenParams = {
  size: string;
  n: number;
  quality?: ImageQuality;
  background?: ImageBackground;
  outputFormat?: ImageOutputFormat;
  outputCompression?: number;
  moderation?: ImageModeration;
  user?: string;
};

export type ImageGenField =
  | 'size'
  | 'n'
  | 'quality'
  | 'background'
  | 'outputFormat'
  | 'outputCompression'
  | 'moderation'
  | 'user';

type FamilySpec = {
  fields: readonly ImageGenField[];
  size: {
    options: readonly string[];
    default: string;
    /**
     * When true, the family also accepts arbitrary `WxH` strings outside the
     * preset list. UI should expose a "custom..." entry that switches to two
     * number inputs validated by `validateCustomDimensions`.
     */
    supportsCustom?: boolean;
  };
  n: { min: number; max: number; default: number };
  quality?: { options: readonly ImageQuality[]; default: ImageQuality };
  background?: { options: readonly ImageBackground[]; default: ImageBackground };
  outputFormat?: { options: readonly ImageOutputFormat[]; default: ImageOutputFormat };
  outputCompression?: { default: number; min: number; max: number };
  moderation?: { options: readonly ImageModeration[]; default: ImageModeration };
};

/**
 * gpt-image-2 custom-dimension constraints from the OpenAI image-generation
 * guide:
 *   - both edges multiples of 16
 *   - max single edge 3840px
 *   - aspect ratio under 3:1
 *   - total pixels between 655,360 and 8,294,400
 *
 * Documented PRESETS may exceed the max-edge / total-pixel rules (the docs
 * list `4096x4096`); presets bypass `validateCustomDimensions` and rely on
 * server-side validation only.
 */
const CUSTOM_SIZE_LIMITS = {
  edgeMultiple: 16,
  edgeMin: 256,
  edgeMax: 3840,
  pixelsMin: 655_360,
  pixelsMax: 8_294_400,
  maxAspectRatio: 3,
} as const;

export const IMAGE_FAMILIES: Record<ImageFamily, FamilySpec> = {
  'gpt-image-2': {
    fields: ['size', 'n', 'quality', 'background', 'outputFormat', 'outputCompression', 'moderation', 'user'],
    size: {
      // Curated common presets — 1:1, 2:3 / 3:2 (portrait/landscape), 16:9 / 9:16
      // (HD video framing), 2K square, 4K square. Plus auto. Custom enabled.
      options: [
        'auto',
        '1024x1024',
        '1024x1536',
        '1536x1024',
        '1280x720',
        '720x1280',
        '2048x2048',
        '4096x4096',
      ],
      default: 'auto',
      supportsCustom: true,
    },
    n: { min: 1, max: 10, default: 1 },
    quality: { options: ['auto', 'low', 'medium', 'high'], default: 'auto' },
    // gpt-image-2 does NOT support `transparent`. Server rejects it; UI just
    // doesn't list the option so the user can never reach that state.
    background: { options: ['auto', 'opaque'], default: 'auto' },
    outputFormat: { options: ['png', 'jpeg', 'webp'], default: 'png' },
    outputCompression: { default: 100, min: 0, max: 100 },
    moderation: { options: ['auto', 'low'], default: 'auto' },
  },
  'gpt-image-1': {
    fields: ['size', 'n', 'quality', 'background', 'outputFormat', 'outputCompression', 'moderation', 'user'],
    size: {
      options: ['auto', '1024x1024', '1024x1536', '1536x1024'],
      default: 'auto',
    },
    n: { min: 1, max: 10, default: 1 },
    quality: { options: ['auto', 'low', 'medium', 'high'], default: 'auto' },
    background: { options: ['auto', 'transparent', 'opaque'], default: 'auto' },
    outputFormat: { options: ['png', 'jpeg', 'webp'], default: 'png' },
    outputCompression: { default: 100, min: 0, max: 100 },
    moderation: { options: ['auto', 'low'], default: 'auto' },
  },
  fallback: {
    fields: ['size', 'n', 'user'],
    size: {
      options: ['1024x1024'],
      default: '1024x1024',
    },
    n: { min: 1, max: 10, default: 1 },
  },
};

/**
 * Family detection — uses `startsWith` so dated aliases like
 * `gpt-image-2-2026-04-21` still resolve. Order matters: gpt-image-2 must be
 * checked before gpt-image-1 so a hypothetical `gpt-image-2.5` doesn't fall
 * back to the gpt-image-1 row.
 */
export function detectImageFamily(model: string | null | undefined): ImageFamily {
  const m = (model ?? '').toLowerCase().trim();
  if (m.startsWith('gpt-image-2')) return 'gpt-image-2';
  if (m.startsWith('gpt-image-1')) return 'gpt-image-1';
  return 'fallback';
}

/** Whether `outputCompression` is meaningful for the chosen `outputFormat`. */
export function isCompressionMeaningful(format: ImageOutputFormat | undefined): boolean {
  return format === 'jpeg' || format === 'webp';
}

/** Whether the family accepts a custom `WxH` size in addition to its presets. */
export function supportsCustomSize(family: ImageFamily): boolean {
  return IMAGE_FAMILIES[family].size.supportsCustom === true;
}

/**
 * Validate a width × height pair against the family-agnostic gpt-image-2
 * custom-dimension rules. Returns the list of error keys (empty when valid).
 */
export function validateCustomDimensions(
  width: number,
  height: number,
): { valid: boolean; errors: CustomSizeError[] } {
  const errors: CustomSizeError[] = [];
  const w = Math.floor(width);
  const h = Math.floor(height);

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    errors.push('notNumeric');
    return { valid: false, errors };
  }
  if (w % CUSTOM_SIZE_LIMITS.edgeMultiple !== 0 || h % CUSTOM_SIZE_LIMITS.edgeMultiple !== 0) {
    errors.push('notMultipleOf16');
  }
  if (w < CUSTOM_SIZE_LIMITS.edgeMin || h < CUSTOM_SIZE_LIMITS.edgeMin) {
    errors.push('edgeTooSmall');
  }
  if (w > CUSTOM_SIZE_LIMITS.edgeMax || h > CUSTOM_SIZE_LIMITS.edgeMax) {
    errors.push('edgeTooLarge');
  }
  const aspect = Math.max(w, h) / Math.min(w, h);
  if (aspect >= CUSTOM_SIZE_LIMITS.maxAspectRatio) {
    errors.push('aspectOutOfRange');
  }
  const pixels = w * h;
  if (pixels < CUSTOM_SIZE_LIMITS.pixelsMin) {
    errors.push('pixelsTooFew');
  }
  if (pixels > CUSTOM_SIZE_LIMITS.pixelsMax) {
    errors.push('pixelsTooMany');
  }
  return { valid: errors.length === 0, errors };
}

export type CustomSizeError =
  | 'notNumeric'
  | 'notMultipleOf16'
  | 'edgeTooSmall'
  | 'edgeTooLarge'
  | 'aspectOutOfRange'
  | 'pixelsTooFew'
  | 'pixelsTooMany';

/** Parse a `"WxH"` size string into numeric components, or null if malformed. */
export function parseSizeString(size: string): { width: number; height: number } | null {
  const match = size.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

/** Build the canonical default params for a family. */
export function defaultParamsFor(family: ImageFamily): ImageGenParams {
  const spec = IMAGE_FAMILIES[family];
  const next: ImageGenParams = {
    size: spec.size.default,
    n: spec.n.default,
  };
  if (spec.quality) next.quality = spec.quality.default;
  if (spec.background) next.background = spec.background.default;
  if (spec.outputFormat) next.outputFormat = spec.outputFormat.default;
  if (spec.outputCompression) next.outputCompression = spec.outputCompression.default;
  if (spec.moderation) next.moderation = spec.moderation.default;
  return next;
}

/**
 * Reconcile the previous params with the new family's allowlist:
 *   - Drop any field the new family does not surface.
 *   - For surfaced fields whose previous value is invalid for the new family,
 *     fall back to that family's default.
 *   - `size` is preserved if it matches a preset OR the new family supports
 *     custom and the value is a syntactically valid `WxH` string.
 */
export function sanitizeParams(prev: ImageGenParams, family: ImageFamily): ImageGenParams {
  const spec = IMAGE_FAMILIES[family];
  const allowed = new Set<ImageGenField>(spec.fields);
  const defaults = defaultParamsFor(family);
  const next: ImageGenParams = { size: defaults.size, n: defaults.n };

  if (allowed.has('size')) {
    if (spec.size.options.includes(prev.size)) {
      next.size = prev.size;
    } else if (spec.size.supportsCustom && parseSizeString(prev.size)) {
      next.size = prev.size;
    } else {
      next.size = defaults.size;
    }
  }
  if (allowed.has('n')) {
    const clamped = Math.max(spec.n.min, Math.min(spec.n.max, Math.floor(prev.n || defaults.n)));
    next.n = Number.isFinite(clamped) ? clamped : defaults.n;
  }
  if (allowed.has('quality') && spec.quality) {
    next.quality = prev.quality && spec.quality.options.includes(prev.quality)
      ? prev.quality
      : spec.quality.default;
  }
  if (allowed.has('background') && spec.background) {
    // Critical: if the user previously had `transparent` on gpt-image-1 and
    // switches to gpt-image-2, the value is invalid for the new family and
    // must fall back to the default (auto).
    next.background = prev.background && spec.background.options.includes(prev.background)
      ? prev.background
      : spec.background.default;
  }
  if (allowed.has('outputFormat') && spec.outputFormat) {
    next.outputFormat = prev.outputFormat && spec.outputFormat.options.includes(prev.outputFormat)
      ? prev.outputFormat
      : spec.outputFormat.default;
  }
  if (allowed.has('outputCompression') && spec.outputCompression) {
    const compression = prev.outputCompression ?? spec.outputCompression.default;
    const clamped = Math.max(spec.outputCompression.min, Math.min(spec.outputCompression.max, Math.floor(compression)));
    next.outputCompression = Number.isFinite(clamped) ? clamped : spec.outputCompression.default;
  }
  if (allowed.has('moderation') && spec.moderation) {
    next.moderation = prev.moderation && spec.moderation.options.includes(prev.moderation)
      ? prev.moderation
      : spec.moderation.default;
  }
  if (allowed.has('user') && prev.user !== undefined) {
    next.user = prev.user;
  }
  return next;
}

/**
 * Build the request payload to send to the server. Applies the family's
 * field allowlist again so any UI bug that leaks an unsupported value never
 * reaches the upstream provider.
 */
export function paramsToRequestPayload(params: ImageGenParams, family: ImageFamily): Partial<ImageGenParams> {
  const spec = IMAGE_FAMILIES[family];
  const allowed = new Set<ImageGenField>(spec.fields);
  const payload: Partial<ImageGenParams> = {};
  if (allowed.has('size')) payload.size = params.size;
  if (allowed.has('n')) payload.n = params.n;
  if (allowed.has('quality') && params.quality) payload.quality = params.quality;
  if (allowed.has('background') && params.background) payload.background = params.background;
  if (allowed.has('outputFormat') && params.outputFormat) payload.outputFormat = params.outputFormat;
  if (
    allowed.has('outputCompression') &&
    params.outputCompression !== undefined &&
    isCompressionMeaningful(params.outputFormat)
  ) {
    payload.outputCompression = params.outputCompression;
  }
  if (allowed.has('moderation') && params.moderation) payload.moderation = params.moderation;
  if (allowed.has('user') && params.user) payload.user = params.user;
  return payload;
}

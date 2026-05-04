import { describe, expect, it } from 'vitest';
import {
  defaultParamsFor,
  detectImageFamily,
  IMAGE_FAMILIES,
  parseSizeString,
  paramsToRequestPayload,
  sanitizeParams,
  supportsCustomSize,
  validateCustomDimensions,
  type ImageGenParams,
} from '../src/shared/imageGen/schema';

describe('imageGenSchema · detectImageFamily', () => {
  it('detects gpt-image-2 (and dated aliases) before gpt-image-1', () => {
    expect(detectImageFamily('gpt-image-2')).toBe('gpt-image-2');
    expect(detectImageFamily('gpt-image-2-2026-04-21')).toBe('gpt-image-2');
    // A hypothetical 2.5 variant must not regress to gpt-image-1.
    expect(detectImageFamily('gpt-image-2.5')).toBe('gpt-image-2');
  });

  it('detects gpt-image-1 (and 1.x aliases) when gpt-image-2 prefix not matched', () => {
    expect(detectImageFamily('gpt-image-1')).toBe('gpt-image-1');
    expect(detectImageFamily('gpt-image-1-2024-12-01')).toBe('gpt-image-1');
    // 1.5 currently rolls into the gpt-image-1 row; future iteration may split.
    expect(detectImageFamily('gpt-image-1.5')).toBe('gpt-image-1');
  });

  it('returns fallback for unknown / dall-e / null / empty', () => {
    expect(detectImageFamily('dall-e-3')).toBe('fallback');
    expect(detectImageFamily('flux-1.1-pro')).toBe('fallback');
    expect(detectImageFamily('')).toBe('fallback');
    expect(detectImageFamily(null)).toBe('fallback');
    expect(detectImageFamily(undefined)).toBe('fallback');
  });
});

describe('imageGenSchema · supportsCustomSize', () => {
  it('only gpt-image-2 supports custom dimensions', () => {
    expect(supportsCustomSize('gpt-image-2')).toBe(true);
    expect(supportsCustomSize('gpt-image-1')).toBe(false);
    expect(supportsCustomSize('fallback')).toBe(false);
  });
});

describe('imageGenSchema · validateCustomDimensions', () => {
  it('accepts a well-formed dimension', () => {
    expect(validateCustomDimensions(1024, 1024)).toEqual({ valid: true, errors: [] });
    expect(validateCustomDimensions(1280, 720)).toEqual({ valid: true, errors: [] });
    expect(validateCustomDimensions(1536, 1024)).toEqual({ valid: true, errors: [] });
  });

  it('flags non-multiples of 16', () => {
    const v = validateCustomDimensions(1080, 720);
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('notMultipleOf16');
  });

  it('flags edge < 256', () => {
    const v = validateCustomDimensions(128, 1024);
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('edgeTooSmall');
  });

  it('flags edge > 3840', () => {
    const v = validateCustomDimensions(4096, 1024);
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('edgeTooLarge');
  });

  it('flags aspect ratio >= 3:1', () => {
    const v = validateCustomDimensions(3840, 1024);
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('aspectOutOfRange');
  });

  it('flags total pixels below 655,360', () => {
    const v = validateCustomDimensions(512, 512);
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('pixelsTooFew');
  });

  it('flags total pixels above 8,294,400', () => {
    const v = validateCustomDimensions(3840, 3840);
    expect(v.valid).toBe(false);
    // 3840*3840 = 14,745,600 — over the cap, edge fine, aspect fine.
    expect(v.errors).toContain('pixelsTooMany');
  });

  it('flags non-numeric / zero / negative', () => {
    expect(validateCustomDimensions(0, 1024).errors).toContain('notNumeric');
    expect(validateCustomDimensions(-100, 1024).errors).toContain('notNumeric');
    expect(validateCustomDimensions(NaN, 1024).errors).toContain('notNumeric');
  });
});

describe('imageGenSchema · parseSizeString', () => {
  it('parses valid WxH strings', () => {
    expect(parseSizeString('1024x1024')).toEqual({ width: 1024, height: 1024 });
    expect(parseSizeString('1280X720')).toEqual({ width: 1280, height: 720 });
    expect(parseSizeString('  1536 x 1024  ')).toEqual({ width: 1536, height: 1024 });
  });

  it('returns null for malformed / preset / empty', () => {
    expect(parseSizeString('auto')).toBeNull();
    expect(parseSizeString('')).toBeNull();
    expect(parseSizeString('1024')).toBeNull();
    expect(parseSizeString('not a size')).toBeNull();
  });
});

describe('imageGenSchema · sanitizeParams', () => {
  it('drops gpt-image-1 transparent when switching to gpt-image-2', () => {
    const prev: ImageGenParams = {
      ...defaultParamsFor('gpt-image-1'),
      background: 'transparent',
    };
    const next = sanitizeParams(prev, 'gpt-image-2');
    expect(next.background).toBe('auto');
  });

  it('preserves a custom WxH when switching gpt-image-2 → gpt-image-2 noop', () => {
    const prev: ImageGenParams = { ...defaultParamsFor('gpt-image-2'), size: '1280x720' };
    const next = sanitizeParams(prev, 'gpt-image-2');
    expect(next.size).toBe('1280x720');
  });

  it('drops a non-preset WxH when switching to a family that does not support custom', () => {
    const prev: ImageGenParams = { ...defaultParamsFor('gpt-image-2'), size: '1280x720' };
    const next = sanitizeParams(prev, 'gpt-image-1');
    // gpt-image-1 has no 1280x720 preset and no custom support → falls back.
    expect(next.size).toBe(IMAGE_FAMILIES['gpt-image-1'].size.default);
  });

  it('preserves a preset that exists in both families', () => {
    const prev: ImageGenParams = { ...defaultParamsFor('gpt-image-2'), size: '1024x1024' };
    const next = sanitizeParams(prev, 'gpt-image-1');
    expect(next.size).toBe('1024x1024');
  });

  it('drops gpt-image-2-only fields when switching to fallback', () => {
    const prev: ImageGenParams = {
      ...defaultParamsFor('gpt-image-2'),
      quality: 'high',
      background: 'opaque',
      outputFormat: 'webp',
      moderation: 'low',
    };
    const next = sanitizeParams(prev, 'fallback');
    expect(next).not.toHaveProperty('quality');
    expect(next).not.toHaveProperty('background');
    expect(next).not.toHaveProperty('outputFormat');
    expect(next).not.toHaveProperty('moderation');
    // size + n + user remain.
    expect(next.size).toBe('1024x1024');
    expect(next.n).toBe(1);
  });
});

describe('imageGenSchema · paramsToRequestPayload', () => {
  it('forwards every gpt-image-2 field when set', () => {
    const params: ImageGenParams = {
      size: '1024x1536',
      n: 2,
      quality: 'high',
      background: 'opaque',
      outputFormat: 'webp',
      outputCompression: 80,
      moderation: 'low',
      user: 'user-123',
    };
    const payload = paramsToRequestPayload(params, 'gpt-image-2');
    expect(payload).toEqual({
      size: '1024x1536',
      n: 2,
      quality: 'high',
      background: 'opaque',
      outputFormat: 'webp',
      outputCompression: 80,
      moderation: 'low',
      user: 'user-123',
    });
  });

  it('drops outputCompression when format is png (compression meaningless)', () => {
    const params: ImageGenParams = {
      ...defaultParamsFor('gpt-image-2'),
      outputFormat: 'png',
      outputCompression: 50,
    };
    const payload = paramsToRequestPayload(params, 'gpt-image-2');
    expect(payload.outputFormat).toBe('png');
    expect(payload).not.toHaveProperty('outputCompression');
  });

  it('forwards a custom WxH size for gpt-image-2', () => {
    const params: ImageGenParams = { ...defaultParamsFor('gpt-image-2'), size: '1280x720' };
    const payload = paramsToRequestPayload(params, 'gpt-image-2');
    expect(payload.size).toBe('1280x720');
  });
});

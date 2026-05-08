import { describe, expect, it } from 'vitest';
import type { ImageGenerationResponse } from '@orison/shared-contracts';
import { normalizeImageResponse } from '../src/imageNormalize';
import { ProtocolHttpError } from '../src/errors';

const ORIGINAL_FETCH = globalThis.fetch;

function buildResponse(images: Array<Record<string, string | undefined>>): ImageGenerationResponse {
  return {
    model: 'dall-e-3',
    images: images as ImageGenerationResponse['images'],
  };
}

describe('normalizeImageResponse', () => {
  it('passes through entries that already have b64Json', async () => {
    const result = await normalizeImageResponse(
      buildResponse([{ b64Json: 'AAA=' }]),
    );
    expect(result.images[0].b64Json).toBe('AAA=');
  });

  it('downloads url-only entries and encodes as base64', async () => {
    const fakeBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    globalThis.fetch = (async () =>
      new Response(fakeBytes, {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      })) as typeof fetch;

    try {
      const result = await normalizeImageResponse(
        buildResponse([{ url: 'https://example.test/img.jpg' }]),
      );
      expect(result.images[0].b64Json).toBe(Buffer.from(fakeBytes).toString('base64'));
    } finally {
      globalThis.fetch = ORIGINAL_FETCH;
    }
  });

  it('throws ProtocolHttpError when entry has neither b64Json nor url', async () => {
    await expect(normalizeImageResponse(buildResponse([{}]))).rejects.toBeInstanceOf(
      ProtocolHttpError,
    );
  });

  it('throws ProtocolHttpError when image download fails', async () => {
    globalThis.fetch = (async () => new Response('oops', { status: 502 })) as typeof fetch;
    try {
      await expect(
        normalizeImageResponse(buildResponse([{ url: 'https://example.test/x.png' }])),
      ).rejects.toMatchObject({ name: 'ProtocolHttpError', status: 502 });
    } finally {
      globalThis.fetch = ORIGINAL_FETCH;
    }
  });
});

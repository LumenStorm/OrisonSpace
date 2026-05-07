import type { ImageGenerationResponse } from '@orison/shared-contracts';
import { ProtocolHttpError } from './errors';

const DEFAULT_MIME_TYPE = 'image/png';

type GeneratedImage = ImageGenerationResponse['images'][number];

/**
 * Normalize a provider image response so every entry carries `b64Json`,
 * `mimeType`, and `dataUrl`. URL-only entries are downloaded inline and
 * encoded as base64.
 *
 * Unlike the previous server-side helper, this version does **not** write a
 * copy to disk — the caller (desktop main → renderer) owns the project-scoped
 * `temp/images/generation` / `assets/images` lifecycle through existing IPC channels.
 */
export async function normalizeImageResponse(
  response: ImageGenerationResponse,
): Promise<ImageGenerationResponse> {
  const images = await Promise.all(response.images.map((image) => normalizeOne(image)));
  return { ...response, images };
}

async function normalizeOne(image: GeneratedImage): Promise<GeneratedImage> {
  if (image.b64Json) {
    const mimeType = image.mimeType ?? DEFAULT_MIME_TYPE;
    return {
      ...image,
      b64Json: image.b64Json,
      mimeType,
      dataUrl: image.dataUrl ?? toDataUrl(image.b64Json, mimeType),
    };
  }

  if (!image.url) {
    throw new ProtocolHttpError('Image provider returned no base64 payload or URL', 502);
  }

  const downloaded = await downloadAsBase64(image.url);
  return {
    ...image,
    b64Json: downloaded.b64Json,
    mimeType: downloaded.mimeType,
    dataUrl: toDataUrl(downloaded.b64Json, downloaded.mimeType),
  };
}

async function downloadAsBase64(url: string): Promise<{ b64Json: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ProtocolHttpError(
      `Image download failed with ${response.status}`,
      response.status,
    );
  }

  const mimeType = readMimeType(response.headers.get('content-type'));
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    b64Json: buffer.toString('base64'),
    mimeType,
  };
}

function readMimeType(contentType: string | null): string {
  const raw = contentType?.split(';')[0]?.trim();
  return raw && raw.startsWith('image/') ? raw : DEFAULT_MIME_TYPE;
}

function toDataUrl(b64Json: string, mimeType: string): string {
  return `data:${mimeType};base64,${b64Json}`;
}

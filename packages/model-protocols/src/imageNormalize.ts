import type { ImageGenerationResponse } from '@orison/shared-contracts';
import { ProtocolHttpError } from './errors';
import { withRetry } from './retry';

type GeneratedImage = ImageGenerationResponse['images'][number];

export async function normalizeImageResponse(
  response: ImageGenerationResponse,
): Promise<ImageGenerationResponse> {
  const images = await Promise.all(response.images.map((image) => normalizeOne(image)));
  return { ...response, images };
}

async function normalizeOne(image: GeneratedImage): Promise<GeneratedImage> {
  if (image.b64Json) return image;
  if (!image.url) {
    throw new ProtocolHttpError('Image provider returned no base64 payload or URL', 502);
  }
  const downloaded = await downloadAsBase64(image.url);
  return { ...image, b64Json: downloaded.b64Json };
}

async function downloadAsBase64(url: string): Promise<{ b64Json: string }> {
  return withRetry(async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new ProtocolHttpError(`Image download failed with ${response.status}`, response.status);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return { b64Json: buffer.toString('base64') };
  });
}

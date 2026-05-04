import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImageGenerationResponse } from '@orison/shared-contracts';
import { GenerationProviderError } from './providers';

const TEMP_IMAGE_DIR = path.resolve(process.cwd(), 'temp', 'generation-images');
const DEFAULT_MIME_TYPE = 'image/png';

type GeneratedImage = ImageGenerationResponse['images'][number];

export async function normalizeImageResponseToBase64(
  response: ImageGenerationResponse,
): Promise<ImageGenerationResponse> {
  const images = await Promise.all(
    response.images.map((image, index) => normalizeGeneratedImage(image, response.provider, index)),
  );

  return {
    ...response,
    images,
  };
}

async function normalizeGeneratedImage(
  image: GeneratedImage,
  provider: string,
  index: number,
): Promise<GeneratedImage> {
  if (image.b64Json) {
    const payload = readBase64Payload(image.b64Json);
    const b64Json = payload?.b64Json ?? image.b64Json;
    const mimeType = image.mimeType ?? payload?.mimeType ?? DEFAULT_MIME_TYPE;
    return {
      ...image,
      b64Json,
      mimeType,
      dataUrl: toDataUrl(b64Json, mimeType),
    };
  }

  if (!image.url) {
    throw new GenerationProviderError('Image provider returned no base64 payload or URL', 502);
  }

  const downloaded = await downloadImageToTemp(image.url, provider, index);
  return {
    ...image,
    b64Json: downloaded.b64Json,
    mimeType: downloaded.mimeType,
    dataUrl: toDataUrl(downloaded.b64Json, downloaded.mimeType),
  };
}

async function downloadImageToTemp(url: string, provider: string, index: number) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new GenerationProviderError(`Image download failed with ${response.status}`, response.status);
  }

  const mimeType = readMimeType(response.headers.get('content-type'));
  const buffer = Buffer.from(await response.arrayBuffer());
  const filePath = path.join(TEMP_IMAGE_DIR, createTempImageName(provider, index, mimeType));

  await mkdir(TEMP_IMAGE_DIR, { recursive: true });
  await writeFile(filePath, buffer);

  return {
    b64Json: buffer.toString('base64'),
    mimeType,
  };
}

function readMimeType(contentType: string | null): string {
  const raw = contentType?.split(';')[0]?.trim();
  return raw && raw.startsWith('image/') ? raw : DEFAULT_MIME_TYPE;
}

function createTempImageName(provider: string, index: number, mimeType: string): string {
  const extension = mimeTypeToExtension(mimeType);
  return `${Date.now()}-${process.hrtime.bigint()}-${safeSegment(provider)}-${index}.${extension}`;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, '_');
}

function mimeTypeToExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/png':
    default:
      return 'png';
  }
}

function toDataUrl(b64Json: string, mimeType: string): string {
  return `data:${mimeType};base64,${b64Json}`;
}

function readBase64Payload(value: string): { mimeType?: string; b64Json: string } | null {
  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  return {
    mimeType: match[1],
    b64Json: match[2],
  };
}

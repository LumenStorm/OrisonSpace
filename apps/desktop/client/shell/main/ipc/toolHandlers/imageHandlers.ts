/**
 * Image tool handlers — generate_image, edit_image
 * Delegates model calls to the existing model gateway, saves results to project.
 */
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { handleGenerateImage } from '../modelGatewayIpc';
import { assertWithinProject } from '../pathGuard';
import { notifyUI } from '../toolNotify';
import type { ToolHandler } from '../toolExecution';
import { atomicWriteFileSync } from '@orison/shared-contracts/fs/atomicWrite';

export const generateImageHandler: ToolHandler = async ({ params, projectDir }) => {
  const { prompt, size, quality, n, outputDir } = params as {
    prompt: string; size?: string; quality?: string; n?: number; outputDir?: string;
  };

  const body = {
    ref: { keyId: 'default', modelId: 'default' },
    request: { model: 'gpt-image-1', prompt, n: n ?? 1, size: size ?? '1024x1024', quality },
  };
  const data = await handleGenerateImage(body) as {
    images: Array<{ b64Json?: string; mimeType?: string }>;
  };

  const subDir = outputDir ?? 'generation';
  const outDir = path.join(projectDir, 'assets', 'images', subDir);
  assertWithinProject(projectDir, outDir);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const savedPaths: string[] = [];
  for (let i = 0; i < data.images.length; i++) {
    const img = data.images[i];
    if (!img.b64Json) continue;
    const ext = img.mimeType?.includes('png') ? 'png' : 'webp';
    const slug = prompt.trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 36);
    const fileName = `${slug}-${i + 1}-${Date.now()}.${ext}`;
    const filePath = path.join(outDir, fileName);
    atomicWriteFileSync(filePath, Buffer.from(img.b64Json, 'base64'));
    savedPaths.push(path.relative(projectDir, filePath));
  }

  notifyUI({ type: 'image:created', paths: savedPaths });
  return {
    title: `generate_image: ${prompt.slice(0, 40)}`,
    output: savedPaths.length > 0
      ? `Generated ${savedPaths.length} image(s):\n${savedPaths.join('\n')}`
      : 'No images returned from the model.',
    metadata: { paths: savedPaths, count: savedPaths.length },
  };
};

export const editImageHandler: ToolHandler = async ({ params, projectDir }) => {
  const { prompt, imagePath, size, n, outputDir } = params as {
    prompt: string; imagePath: string; size?: string; n?: number; outputDir?: string;
  };

  // Read source image and convert to base64
  const fullImagePath = path.resolve(projectDir, imagePath);
  assertWithinProject(projectDir, fullImagePath);
  if (!existsSync(fullImagePath)) throw new Error(`Source image not found: ${imagePath}`);
  const imageBuffer = readFileSync(fullImagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

  const body = {
    ref: { keyId: 'default', modelId: 'default' },
    request: {
      model: 'gpt-image-1',
      prompt,
      image: { b64Json: imageBuffer.toString('base64'), mimeType },
      n: n ?? 1,
      size: size ?? '1024x1024',
    },
  };
  const data = await handleGenerateImage(body) as {
    images: Array<{ b64Json?: string; mimeType?: string }>;
  };

  const subDir = outputDir ?? 'edits';
  const outDir = path.join(projectDir, 'assets', 'images', subDir);
  assertWithinProject(projectDir, outDir);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const savedPaths: string[] = [];
  for (let i = 0; i < data.images.length; i++) {
    const img = data.images[i];
    if (!img.b64Json) continue;
    const ext = img.mimeType?.includes('png') ? 'png' : 'webp';
    const fileName = `edit-${Date.now()}-${i + 1}.${ext}`;
    const filePath = path.join(outDir, fileName);
    atomicWriteFileSync(filePath, Buffer.from(img.b64Json, 'base64'));
    savedPaths.push(path.relative(projectDir, filePath));
  }

  notifyUI({ type: 'image:created', paths: savedPaths });
  return {
    title: `edit_image: ${prompt.slice(0, 40)}`,
    output: savedPaths.length > 0
      ? `Edited ${savedPaths.length} image(s):\n${savedPaths.join('\n')}`
      : 'No images returned.',
    metadata: { paths: savedPaths },
  };
};

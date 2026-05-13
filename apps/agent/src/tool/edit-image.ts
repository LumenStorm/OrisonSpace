import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from './define';
import { env } from '../env';

export const editImageTool = defineTool({
  id: 'edit_image',
  description: 'Edit an existing image using a prompt. Reads the source image from the project, sends it with the prompt, and saves the result.',
  parameters: z.object({
    imagePath: z.string().describe('Relative path to the source image in the project'),
    prompt: z.string().describe('Edit instruction prompt'),
    maskPath: z.string().optional().describe('Relative path to a mask image (white = edit area)'),
    outputDir: z.string().optional().describe('Subdirectory under assets/images/ to save to'),
  }),
  async execute(params, ctx) {
    const srcPath = path.resolve(ctx.projectPath, params.imagePath);
    if (!srcPath.startsWith(ctx.projectPath)) throw new Error('Path traversal not allowed');

    const srcBuffer = await readFile(srcPath);
    const srcB64 = srcBuffer.toString('base64');
    const srcExt = path.extname(params.imagePath).slice(1);
    const mimeType = srcExt === 'png' ? 'image/png' : srcExt === 'webp' ? 'image/webp' : 'image/jpeg';

    const request: Record<string, unknown> = {
      model: 'gpt-image-1',
      prompt: params.prompt,
      image: { b64Json: srcB64, mimeType },
    };

    if (params.maskPath) {
      const maskFullPath = path.resolve(ctx.projectPath, params.maskPath);
      if (!maskFullPath.startsWith(ctx.projectPath)) throw new Error('Path traversal not allowed');
      const maskBuffer = await readFile(maskFullPath);
      request.mask = { b64Json: maskBuffer.toString('base64'), mimeType: 'image/png' };
    }

    const res = await fetch(`${env.MODEL_GATEWAY_URL}/images/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: { keyId: 'default', modelId: 'default' }, request }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Image edit failed (${res.status}): ${text}`);
    }

    const data = await res.json() as {
      images: Array<{ b64Json?: string; mimeType?: string }>;
    };

    const subDir = params.outputDir ?? 'edits';
    const outDir = path.join(ctx.projectPath, 'assets', 'images', subDir);
    await mkdir(outDir, { recursive: true });

    const savedPaths: string[] = [];
    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i];
      if (!img.b64Json) continue;
      const ext = img.mimeType?.includes('png') ? 'png' : 'webp';
      const fileName = `edit-${Date.now()}-${i + 1}.${ext}`;
      await writeFile(path.join(outDir, fileName), Buffer.from(img.b64Json, 'base64'));
      savedPaths.push(path.relative(ctx.projectPath, path.join(outDir, fileName)));
    }

    return {
      title: `edit_image: ${params.prompt.slice(0, 40)}`,
      output: savedPaths.length > 0
        ? `Edited ${savedPaths.length} image(s):\n${savedPaths.join('\n')}`
        : 'No images returned.',
      metadata: { paths: savedPaths },
    };
  },
});

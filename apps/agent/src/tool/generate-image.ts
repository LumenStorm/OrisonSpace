import { z } from 'zod';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from './define';
import { env } from '../env';

export const generateImageTool = defineTool({
  id: 'generate_image',
  description: 'Generate an image from a text prompt. Saves the result to the project assets directory and returns the file path.',
  parameters: z.object({
    prompt: z.string().describe('Image generation prompt'),
    size: z.string().optional().describe('Image size (e.g. "1024x1024", "1792x1024")'),
    quality: z.string().optional().describe('Quality level: "auto", "low", "medium", "high"'),
    n: z.number().int().positive().optional().describe('Number of images to generate (default 1)'),
    outputDir: z.string().optional().describe('Subdirectory under assets/images/ to save to'),
  }),
  async execute(params, ctx) {
    const body = {
      ref: { keyId: 'default', modelId: 'default' },
      request: {
        model: 'gpt-image-1',
        prompt: params.prompt,
        n: params.n ?? 1,
        size: params.size ?? '1024x1024',
        quality: params.quality,
      },
    };

    const res = await fetch(`${env.MODEL_GATEWAY_URL}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Image generation failed (${res.status}): ${text}`);
    }

    const data = await res.json() as {
      model: string;
      images: Array<{ b64Json?: string; url?: string; mimeType?: string }>;
    };

    const subDir = params.outputDir ?? 'generation';
    const outDir = path.join(ctx.projectPath, 'assets', 'images', subDir);
    await mkdir(outDir, { recursive: true });

    const savedPaths: string[] = [];
    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i];
      if (!img.b64Json) continue;

      const ext = img.mimeType?.includes('png') ? 'png' : 'webp';
      const slug = params.prompt.trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 36);
      const fileName = `${slug}-${i + 1}-${Date.now()}.${ext}`;
      const filePath = path.join(outDir, fileName);

      await writeFile(filePath, Buffer.from(img.b64Json, 'base64'));
      savedPaths.push(path.relative(ctx.projectPath, filePath));
    }

    return {
      title: `generate_image: ${params.prompt.slice(0, 40)}`,
      output: savedPaths.length > 0
        ? `Generated ${savedPaths.length} image(s):\n${savedPaths.join('\n')}`
        : 'No images returned from the model.',
      metadata: { paths: savedPaths, count: savedPaths.length },
    };
  },
});

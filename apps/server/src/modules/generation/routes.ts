import type { FastifyInstance } from 'fastify';
import {
  generationProviderSchema,
  imageGenerationRequestSchema,
  textGenerationRequestSchema,
} from '@orison/shared-contracts';
import { generateImage, generateText } from './service';
import { GenerationProviderError } from './providers';

export async function registerGenerationRoutes(app: FastifyInstance) {
  app.post('/v1/generation/:provider/text', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const parsedProvider = generationProviderSchema.parse(provider);
    const payload = textGenerationRequestSchema.parse(request.body);

    try {
      return reply.send(await generateText(parsedProvider, payload));
    } catch (error) {
      if (error instanceof GenerationProviderError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  app.post('/v1/generation/:provider/image', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const parsedProvider = generationProviderSchema.parse(provider);
    const payload = imageGenerationRequestSchema.parse(request.body);

    try {
      return reply.send(await generateImage(parsedProvider, payload));
    } catch (error) {
      if (error instanceof GenerationProviderError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}

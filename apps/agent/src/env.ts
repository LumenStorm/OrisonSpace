import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(18422),
  LOG_LEVEL: z.string().default('info'),
  MODEL_GATEWAY_URL: z.string().default('http://127.0.0.1:18421'),
});

export const env = envSchema.parse(process.env);

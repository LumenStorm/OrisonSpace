import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(18422),
  LOG_LEVEL: z.string().default('info'),
});

export const env = envSchema.parse(process.env);

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),
  DEMO_ACCESS_TOKEN: z.string().default('demo-access-token')
});

export const env = envSchema.parse(process.env);

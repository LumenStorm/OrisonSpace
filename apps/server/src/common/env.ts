import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),
  DEMO_ACCESS_TOKEN: z.string().default('demo-access-token'),
  DATABASE_URL: z.string().default('postgresql://postgres:root@localhost:5432/orison_dev'),
  JWT_SECRET: z.string().default('orison-dev-secret-key')
});

export const env = envSchema.parse(process.env);

import { z } from 'zod';
import { config } from 'dotenv';
import { DEFAULT_AGENT_URL } from '@orison/shared-contracts';

// Load .env with override so local .env always wins over stale system env vars
config({ override: true });

const isProd = process.env.NODE_ENV === 'production';

const envSchema = z.object({
  PORT: z.coerce.number().default(43117),
  LOG_LEVEL: z.string().default('info'),
  DEMO_ACCESS_TOKEN: z.string().default('demo-access-token'),
  DATABASE_URL: z.string().default('postgresql://postgres:root@localhost:5432/orison_dev'),
  AGENT_URL: z.string().default(DEFAULT_AGENT_URL),
  JWT_SECRET: isProd
    ? z.string().min(32, 'JWT_SECRET must be at least 32 characters in production')
    : z.string().default('orison-dev-secret-key-NOT-FOR-PRODUCTION'),
});

export const env = envSchema.parse(process.env);

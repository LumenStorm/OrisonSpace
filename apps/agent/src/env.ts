import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(18422),
  LOG_LEVEL: z.string().default('info'),
  MODEL_GATEWAY_URL: z.string().default('http://127.0.0.1:18421'),
  ORISON_AGENT_EXTERNAL_SKILL_ROOTS: z.string().default('I:\\echo\\oh-story-claudecode-main'),
});

export const env = envSchema.parse(process.env);

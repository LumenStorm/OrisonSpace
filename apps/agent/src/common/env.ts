import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(18422),
  LOG_LEVEL: z.string().default('info'),
  /**
   * Story-sync 节点工作模式：
   *  - rules：纯启发式规则（默认，向后兼容）
   *  - llm：先尝试调用 LLM，失败回退 rules
   */
  ORISON_STORY_SYNC_MODE: z.enum(['rules', 'llm']).default('rules'),
  /** LLM 调用走的 server generation route 基地址，例如 http://127.0.0.1:4000 */
  ORISON_LLM_SERVER_URL: z.string().url().optional(),
  /** Provider，对应 server `/v1/generation/:provider/text` 中的 :provider */
  ORISON_LLM_PROVIDER: z.enum(['openai', 'gcp', 'anthropic']).default('openai'),
  /** LLM 模型名 */
  ORISON_LLM_MODEL: z.string().default('gpt-4o-mini'),
  /** 透传到 provider 的 API key（server 层会校验） */
  ORISON_LLM_API_KEY: z.string().optional(),
  /** 透传到 provider 的 base URL（自托管 / 代理） */
  ORISON_LLM_BASE_URL: z.string().url().optional(),
  /** Story-sync LLM 调用超时（ms） */
  ORISON_STORY_SYNC_LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
});

export const env = envSchema.parse(process.env);

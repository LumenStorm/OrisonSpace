import type { z } from 'zod';
import type { orchestrationRunSchema } from '@orison/shared-contracts';

export type RunSnapshot = z.infer<typeof orchestrationRunSchema>;

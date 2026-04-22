import { z } from 'zod';

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    displayName: z.string().min(1)
  })
});

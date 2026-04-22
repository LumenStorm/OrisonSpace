import { z } from 'zod';
export const desktopIpcSchema = z.object({
    channel: z.enum(['project:pick-directory'])
});

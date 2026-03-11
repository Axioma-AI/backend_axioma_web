import { z } from 'zod';

export const AdminGroupDeleteParamsSchema = z.object({
  groupId: z.coerce.number().int().min(1),
});

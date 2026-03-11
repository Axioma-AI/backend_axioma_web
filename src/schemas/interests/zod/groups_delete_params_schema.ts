import { z } from 'zod';

export const InterestsGroupDeleteParamsSchema = z.object({
  groupId: z.coerce.number().int().min(1),
});

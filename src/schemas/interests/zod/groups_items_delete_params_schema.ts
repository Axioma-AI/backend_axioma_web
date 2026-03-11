import { z } from 'zod';

export const InterestsGroupItemDeleteParamsSchema = z.object({
  groupId: z.coerce.number().int().min(1),
  interestId: z.coerce.number().int().min(1),
});

import { z } from 'zod';

export const InterestsDeleteParamsSchema = z.object({
  interestId: z.coerce.number().int().min(1),
});

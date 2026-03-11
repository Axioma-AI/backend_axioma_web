import { z } from 'zod';

export const AdminInterestDeleteParamsSchema = z.object({
  interestId: z.coerce.number().int().min(1),
});

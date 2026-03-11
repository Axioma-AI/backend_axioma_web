import { z } from 'zod';

export const InterestsCreateSchema = z.object({
  name: z.string().min(1).transform(s => s.trim()).refine(s => s.length > 0),
});

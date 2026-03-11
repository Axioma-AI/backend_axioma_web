import { z } from 'zod';

export const AdminGroupItemAddBodySchema = z.object({
  interest_id: z.coerce.number().int().min(1).optional(),
  interest_name: z.string().optional().transform(s => (s ? s.trim() : undefined)),
}).refine(obj => (obj.interest_id ? 1 : 0) + (obj.interest_name ? 1 : 0) === 1, {
  message: 'Proveer exactamente uno: interest_id o interest_name',
});

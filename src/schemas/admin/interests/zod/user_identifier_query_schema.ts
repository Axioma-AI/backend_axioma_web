import { z } from 'zod';

export const AdminUserIdentifierQuerySchema = z.object({
  id: z.coerce.number().int().min(1).optional(),
  email: z.string().optional().transform(s => (s ? s.trim().toLowerCase() : undefined)),
  username: z.string().optional().transform(s => (s ? s.trim() : undefined)),
}).refine(obj => {
  const provided = (obj.id ? 1 : 0) + (obj.email ? 1 : 0) + (obj.username ? 1 : 0);
  return provided === 1;
}, { message: 'Provide exactly one identifier: id OR email OR username.' });

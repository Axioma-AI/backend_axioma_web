import { z } from 'zod';

export const AdminGroupsCreateBodySchema = z.object({
  name: z.string().min(1).transform(s => s.trim()).refine(s => s.length > 0),
  interest_names: z.union([z.array(z.string()), z.string()]).optional().transform(v => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(s => s.trim()).filter(Boolean);
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }),
});

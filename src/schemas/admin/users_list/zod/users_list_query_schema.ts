import { z } from "zod";

const toNumber = (v: any): number | undefined => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t.length) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

export const AdminUsersListQuerySchema = z.object({
  page: z.preprocess(toNumber, z.number().int().min(1)).optional(),
  size: z.preprocess(toNumber, z.number().int().min(1).max(100)).optional(),
  q: z.string().min(1).optional(),
  role_name: z.enum(["admin", "member"]).optional(),
}).strict();

export type AdminUsersListQueryInput = z.infer<typeof AdminUsersListQuerySchema>;

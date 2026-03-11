import { z } from "zod";

export const LoginRequestSchema = z
  .object({
    email: z.string().email().optional(),
    username: z
      .string()
      .regex(/^[a-zA-Z0-9_.-]{3,20}$/)
      .optional(),
    password: z.string().min(8),
    two_factor_token: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    force_new_session: z
      .union([
        z.boolean(),
        z.string().transform((s) =>
          ["true", "1", "yes", "on"].includes(s.trim().toLowerCase())
        ),
      ])
      .optional(),
  })
  .refine(
    (v) => v.email !== undefined || v.username !== undefined,
    { message: "Provee email o username válido." }
  );

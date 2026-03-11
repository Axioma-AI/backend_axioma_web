import { z } from "zod";

export const UpdateProfileSchema = z
  .object({
    name: z
      .string()
      .optional()
      .transform((s) => {
        const t = (s ?? "").trim();
        return t.length ? t : undefined;
      })
      .refine((s) => s === undefined || s.length >= 2, {
        message: "Invalid name (minimum 2 characters).",
      }),
    lastname: z
      .string()
      .optional()
      .transform((s) => {
        const t = (s ?? "").trim();
        return t.length ? t : undefined;
      })
      .refine((s) => s === undefined || s.length >= 2, {
        message: "Invalid last name (minimum 2 characters).",
      }),
    username: z
      .string()
      .optional()
      .transform((s) => {
        const t = (s ?? "").trim();
        return t.length ? t : undefined;
      })
      .refine((s) => s === undefined || /^[a-zA-Z0-9_.-]{3,20}$/.test(s), {
        message: "Invalid username (3-20; letters, numbers, . _ -).",
      }),
    phone: z.preprocess(
      (v) => {
        if (typeof v === "string") {
          const t = v.trim();
          return t.length ? t : undefined;
        }
        return v;
      },
      z.union([z.string().regex(/^\d{6,15}$/), z.null()]).optional()
    ),
    country_code: z
      .string()
      .optional()
      .transform((s) => {
        const t = (s ?? "").trim();
        return t.length ? t : undefined;
      })
      .refine((s) => s === undefined || s.length <= 10, {
        message: "Invalid country code (maximum 10 characters).",
      }),
  })
  .superRefine((_v, _ctx) => {});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

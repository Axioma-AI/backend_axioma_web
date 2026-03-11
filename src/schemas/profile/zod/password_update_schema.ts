import { z } from "zod";
import { validatePasswordStrength } from "../../../utils/validators";

export const PasswordUpdateSchema = z
  .object({
    current_password: z.string().min(8, "Invalid current password (minimum 8 characters)."),
    new_password: z.string(),
  })
  .superRefine((v, ctx) => {
    try {
      validatePasswordStrength(v.new_password);
    } catch (e: any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["new_password"],
        message: e?.message ?? "Invalid password.",
      });
    }
  });

export type PasswordUpdateInput = z.infer<typeof PasswordUpdateSchema>;

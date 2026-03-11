import { z } from "zod";
import { validateEmail, validateUsername, validatePasswordStrength } from "../../../../utils/validators";

export const ForgotPasswordSchema = z
  .object({
    email: z.string().email().optional(),
    username: z.string().regex(/^[a-zA-Z0-9_.-]{3,20}$/).optional(),
    last_password: z.string(),
    new_password: z.string(),
    first_name: z.string().optional(),
    last_name_paternal: z.string().optional(),
    last_name_maternal: z.string().optional(),
    country_code: z.string().optional(),
    phone: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.username) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Debe proporcionar email o username válido." });
    }
    if (v.email) {
      try {
        validateEmail(v.email);
      } catch (e: any) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: e?.message ?? "Email inválido." });
      }
    }
    if (v.username) {
      try {
        validateUsername(v.username);
      } catch (e: any) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["username"], message: e?.message ?? "Username inválido." });
      }
    }
    try {
      validatePasswordStrength(v.new_password);
    } catch (e: any) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["new_password"], message: e?.message ?? "Password inválida." });
    }
    const toNonEmpty = (s?: string) => (typeof s === "string" && s.trim().length > 0 ? s.trim() : undefined);
    const answers = [
      toNonEmpty(v.first_name),
      toNonEmpty(v.last_name_paternal),
      toNonEmpty(v.last_name_maternal),
      toNonEmpty(v.country_code),
      toNonEmpty(v.phone),
    ].filter(Boolean);
    if (answers.length < 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe proporcionar al menos tres respuestas de seguridad válidas." });
    }
  });

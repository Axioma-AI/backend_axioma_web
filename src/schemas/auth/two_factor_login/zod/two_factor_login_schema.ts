import { z } from "zod";

export const TwoFactorLoginSchema = z
  .union([
    z.object({
      two_factor_token: z.string().regex(/^\d{6}$/, "two_factor_token debe ser un código de 6 dígitos."),
    }),
    z.object({
      token: z.string().regex(/^\d{6}$/, "token debe ser un código de 6 dígitos."),
    }),
  ])
  .transform((v) => ({
    two_factor_token: "two_factor_token" in v ? v.two_factor_token : v.token,
  }));

export type TwoFactorLoginInput = z.infer<typeof TwoFactorLoginSchema>;

export const TwoFactorRecoveryLoginSchema = z.object({
  recovery_code: z
    .string()
    .regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i, "Formato inválido de recovery_code (XXXX-XXXX-XXXX)."),
});

export type TwoFactorRecoveryLoginInput = z.infer<typeof TwoFactorRecoveryLoginSchema>;

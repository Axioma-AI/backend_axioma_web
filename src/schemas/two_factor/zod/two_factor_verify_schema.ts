import { z } from "zod";

export const TwoFactorVerifySchema = z
  .object({
    token: z.string().regex(/^\d{6}$/, "token debe ser un código de 6 dígitos."),
  })
  .strict();

export type TwoFactorVerifyInput = z.infer<typeof TwoFactorVerifySchema>;

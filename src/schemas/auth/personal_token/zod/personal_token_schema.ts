import { z } from "zod";
import { PERSONAL_TOKEN_EXPIRY_PRESETS } from "../personal_token";

export const PersonalTokenCreateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    expires_preset: z.enum(PERSONAL_TOKEN_EXPIRY_PRESETS as [string, ...string[]]).optional(),
  })
  .strict();

export type PersonalTokenCreateInput = z.infer<typeof PersonalTokenCreateSchema>;

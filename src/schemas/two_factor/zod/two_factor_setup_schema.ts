import { z } from "zod";

export const TwoFactorSetupSchema = z.object({}).strict();

export type TwoFactorSetupInput = z.infer<typeof TwoFactorSetupSchema>;

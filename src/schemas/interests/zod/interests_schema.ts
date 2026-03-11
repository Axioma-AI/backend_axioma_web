import { z } from "zod";

export const InterestCreateSchema = z.object({
  name: z.string().min(1).max(255),
}).strict();

export type InterestCreateInput = z.infer<typeof InterestCreateSchema>;

export const InterestGroupCreateSchema = z.object({
  name: z.string().min(1).max(255),
  interest_names: z.array(z.string().min(1).max(255)).optional(),
}).strict();

export type InterestGroupCreateInput = z.infer<typeof InterestGroupCreateSchema>;

export const InterestGroupAddItemSchema = z.object({
  interest_id: z.number().int().positive().optional(),
  interest_name: z.string().min(1).max(255).optional(),
}).refine((v) => Number.isFinite(v.interest_id as any) !== (typeof v.interest_name === "string"), {
  message: "Proveer exactamente uno: interest_id o interest_name",
});

export type InterestGroupAddItemInput = z.infer<typeof InterestGroupAddItemSchema>;

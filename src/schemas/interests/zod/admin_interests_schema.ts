import { z } from "zod";

export const AdminAssignSeatsSchema = z.object({
  seats: z.number().int().min(0).max(20),
}).strict();

export type AdminAssignSeatsInput = z.infer<typeof AdminAssignSeatsSchema>;

export const AdminInterestCreateSchema = z.object({
  name: z.string().min(1).max(255),
}).strict();

export type AdminInterestCreateInput = z.infer<typeof AdminInterestCreateSchema>;

export const AdminInterestGroupAddItemSchema = z.object({
  interest_id: z.number().int().positive().optional(),
  interest_name: z.string().min(1).max(255).optional(),
}).refine((v) => Number.isFinite(v.interest_id as any) !== (typeof v.interest_name === "string"), {
  message: "Proveer exactamente uno: interest_id o interest_name",
});

export type AdminInterestGroupAddItemInput = z.infer<typeof AdminInterestGroupAddItemSchema>;

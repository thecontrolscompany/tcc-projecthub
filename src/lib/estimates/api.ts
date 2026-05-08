import { z } from "zod";

export const ESTIMATE_READ_ROLES = ["admin", "ops_manager", "pm", "lead"] as const;
export const ESTIMATE_WRITE_ROLES = ["admin", "ops_manager", "pm", "lead"] as const;

export const ESTIMATE_SELECT = `
  id, organization_id, owner_id, body, name, number, archived, linked_project_id, linked_opportunity_id,
  status, total_amount, gross_margin_amount, gross_margin_pct,
  proposal_exported_at, estimate_ready_at, created_at, updated_at
`;

export const estimateStatusSchema = z.enum([
  "draft",
  "in_progress",
  "ready",
  "proposal_exported",
  "awarded",
  "archived",
]);

export const estimateBodySchema = z.record(z.string(), z.unknown());

export const estimateCreateSchema = z.object({
  id: z.string().min(1).optional(),
  organization_id: z.string().uuid().nullish(),
  body: estimateBodySchema,
  linked_opportunity_id: z.string().uuid().nullish(),
  linked_project_id: z.string().uuid().nullish(),
  status: estimateStatusSchema.default("draft"),
  archived: z.boolean().default(false),
  total_amount: z.number().finite().nullish(),
  gross_margin_amount: z.number().finite().nullish(),
  gross_margin_pct: z.number().finite().nullish(),
  proposal_exported_at: z.string().datetime().nullish(),
  estimate_ready_at: z.string().datetime().nullish(),
});

export const estimateUpdateSchema = estimateCreateSchema
  .omit({ id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export function canReadEstimates(role: string) {
  return (ESTIMATE_READ_ROLES as readonly string[]).includes(role);
}

export function canWriteEstimates(role: string) {
  return (ESTIMATE_WRITE_ROLES as readonly string[]).includes(role);
}

export function deriveEstimateLifecycleFields(input: {
  status?: z.infer<typeof estimateStatusSchema>;
  archived?: boolean;
}) {
  const now = new Date().toISOString();

  return {
    ...(input.status === "ready" ? { estimate_ready_at: now } : {}),
    ...(input.status === "proposal_exported" ? { proposal_exported_at: now, estimate_ready_at: now } : {}),
    ...(input.status === "archived" || input.archived ? { archived: true } : {}),
  };
}

const resolveFurnishingActivation = (): Readonly<{ allowed:boolean; reason:string }> => ({ allowed: false, reason: "killed_globally" });

export type ProductFamily = "furnishing" | "hpm" | "guidebook_studio" | "investment_intelligence";
export type DeliveryChannel = "email" | "sms" | "in-app" | "slack" | "teams";
export type DeliveryOutcome = Readonly<{ status: "delivered" | "suppressed"; reasonCode?: string }>;
export type DeliveryEnvelope = Readonly<{ id: string; workspaceId: string; channel: DeliveryChannel; productFamily: ProductFamily | null; idempotencyKey: string; attempt: number; mode: "scheduled" | "retry" | "replay" | "bulk" | "manual_resend" | "normal" }>;

export function hydrateDeliveryEnvelope(row: Readonly<Record<string, unknown>>, mode: DeliveryEnvelope["mode"] = "normal"): DeliveryEnvelope {
  const family = row.product_family;
  if (family !== null && family !== undefined && !["furnishing", "hpm", "guidebook_studio", "investment_intelligence"].includes(String(family))) throw new Error("NOTIFICATION_PRODUCT_FAMILY_INVALID");
  return Object.freeze({ id: String(row.id), workspaceId: String(row.workspace_id), channel: String(row.channel) as DeliveryChannel, productFamily: family ? String(family) as ProductFamily : null, idempotencyKey: String(row.idempotency_key), attempt: Number(row.attempt_count ?? 0), mode });
}

export function guardDeliveryEffect(envelope: DeliveryEnvelope): DeliveryOutcome {
  if (envelope.productFamily !== "furnishing") return { status: "delivered" };
  const decision = resolveFurnishingActivation({ globalKillSwitch: true, globalState: "disabled", workspaceKillSwitch: false, workspaceEnabled: false, cohortEligible: false, capabilityEnabled: false, configurationValid: true, policyVersion: "fs008a-v1" });
  return decision.allowed ? { status: "delivered" } : { status: "suppressed", reasonCode: `FURNISHING_NOTIFICATION_${decision.reason.toUpperCase()}` };
}

export type DeliveryAdapter = (envelope: DeliveryEnvelope) => Promise<DeliveryOutcome>;
export async function deliverThroughAdapter(envelope: DeliveryEnvelope, provider: () => Promise<void>): Promise<DeliveryOutcome> {
  const outcome = guardDeliveryEffect(envelope);
  if (outcome.status === "suppressed") return outcome;
  await provider();
  return outcome;
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProvisionControlledGuidebookProperty = Readonly<{
  customerAccountId: string;
  entitlementId: string;
  internalName: string;
  publicDisplayName: string;
  propertyType: string;
  city: string;
  region: string;
  timeZone: string;
  controlledVerification: true;
  reason: string;
  idempotencyKey: string;
  expectedCustomerStatus: "active";
  expectedEntitlementRevision: number;
  verificationRunId: string;
}>;

export type ControlledPropertyResult = Readonly<{
  propertyId: string;
  allocationId: string;
  entitlementId: string;
  replayed: boolean;
}>;

type RpcResult = Readonly<{
  propertyId: string;
  allocationId: string;
  entitlementId: string;
  replayed?: boolean;
  released?: boolean;
}>;

/**
 * Request-scoped owning-domain port. The database derives the administrator
 * from auth.uid(); a service-role client is deliberately not accepted here.
 */
export class ControlledGuidebookPropertyService {
  constructor(private readonly client: SupabaseClient) {}

  async provision(
    input: ProvisionControlledGuidebookProperty,
  ): Promise<ControlledPropertyResult> {
    const { data, error } = await this.client.rpc(
      "provision_guidebook_property_for_customer",
      {
        p_customer_account_id: input.customerAccountId,
        p_entitlement_id: input.entitlementId,
        p_internal_name: input.internalName,
        p_public_display_name: input.publicDisplayName,
        p_property_type: input.propertyType,
        p_city: input.city,
        p_region: input.region,
        p_timezone: input.timeZone,
        p_controlled_verification: input.controlledVerification,
        p_reason: input.reason,
        p_idempotency_key: input.idempotencyKey,
        p_expected_customer_status: input.expectedCustomerStatus,
        p_expected_entitlement_revision: input.expectedEntitlementRevision,
        p_verification_run_id: input.verificationRunId,
      },
    );
    if (error || !data) throw new Error(safeCode(error?.message));
    const result = data as RpcResult;
    return {
      propertyId: result.propertyId,
      allocationId: result.allocationId,
      entitlementId: result.entitlementId,
      replayed: result.replayed === true,
    };
  }

  async cleanup(
    input: Readonly<{
      propertyId: string;
      reason: string;
      expectedAllocationRevision: number;
    }>,
  ) {
    const { data, error } = await this.client.rpc(
      "cleanup_controlled_guidebook_property",
      {
        p_property_id: input.propertyId,
        p_reason: input.reason,
        p_expected_allocation_revision: input.expectedAllocationRevision,
      },
    );
    if (error || !data) throw new Error(safeCode(error?.message));
    return data as RpcResult;
  }
}

export function controlledProvisioningGate(actorId: string) {
  const cohort = (process.env.CONTROLLED_GUIDEBOOK_PROVISIONING_COHORT ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return (
    process.env.CONTROLLED_GUIDEBOOK_PROVISIONING_ENABLED === "true" &&
    process.env.CONTROLLED_GUIDEBOOK_PROVISIONING_KILL_SWITCH !== "true" &&
    cohort.includes(actorId)
  );
}

function safeCode(value?: string) {
  const match = value?.match(/CONTROLLED_[A-Z0-9_]+/);
  return match?.[0] ?? "CONTROLLED_PROPERTY_OPERATION_FAILED";
}

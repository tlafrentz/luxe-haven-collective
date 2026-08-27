import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assertFurnishingActivationMutationDisabled } from "@/features/furnishing-studio/activation";
import { canonicalFurnishingEntitlementAvailable } from "./furnishing-entitlement-projection";

export function assertFurnishingMutationAllowed(): void {
  return assertFurnishingActivationMutationDisabled();
}

export async function assertFurnishingEntitlement(
  workspaceId: string,
  platformAdmin = false,
) {
  if (platformAdmin) return;
  const client = await createClient(),
    { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("FURNISHING_ENTITLEMENT_REQUIRED");
  const { data: membership, error: membershipError } = await client
    .from("customer_account_memberships")
    .select("tenant_id,customer_account_id")
    .eq("profile_id", user.id)
    .eq("tenant_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError || !membership)
    throw new Error("FURNISHING_ENTITLEMENT_REQUIRED");
  const now = new Date().toISOString(),
    { data: entitlements, error: entitlementError } = await client
      .from("commercial_entitlements")
      .select("status,effective_from,effective_until,resource_scope_type,resource_scope_id")
      .eq("tenant_id", workspaceId)
      .eq("customer_account_id", membership.customer_account_id)
      .eq("capability_code", "furnishing.project.access")
      .eq("status", "active")
      .lte("effective_from", now);
  if (entitlementError || !canonicalFurnishingEntitlementAvailable(entitlements ?? [], {
    workspaceId,
    customerAccountId: membership.customer_account_id,
    now,
  })) throw new Error("FURNISHING_ENTITLEMENT_REQUIRED");
}

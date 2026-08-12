import { createAdminClient } from "@/lib/supabase/admin";
type ProductFamilyCode="hpm"|"guidebook_studio"|"furnishing"|"investment_intelligence";
import { ProvisionOnboardingProductContext } from "../application";
import { composeIndependentProductAdapters } from "./product-provisioning-adapters";
import { SupabaseOnboardingProvisioningState } from "./supabase-provisioning-state";
import { SupabaseOwningProductProvisioningOperation } from "./supabase-product-operation";
import { SupabaseProductProvisioningLedger } from "./supabase-provisioning-ledger";

export function createProductionProductProvisioning(actorId:string, correlationId:string) {
  const client = createAdminClient();
  const state = new SupabaseOnboardingProvisioningState(client);
  const families: readonly ProductFamilyCode[] = ["hpm", "guidebook_studio", "furnishing", "investment_intelligence"];
  const operations = Object.fromEntries(families.map(family => [family, new SupabaseOwningProductProvisioningOperation(client, family)])) as Record<ProductFamilyCode, SupabaseOwningProductProvisioningOperation>;
  const ports = composeIndependentProductAdapters({ actorId, correlationId, operations, ledger:new SupabaseProductProvisioningLedger(client) });
  return new ProvisionOnboardingProductContext({
    authorize: value => state.authorize(value),
    evaluateEntitlement: value => state.evaluateEntitlement(value),
    loadCase: caseId => state.loadCase(caseId),
    checkLimit: value => state.checkLimit(value),
    ports,
    findExisting: (caseId, family) => state.findExisting(caseId, family),
    saveReference: value => state.saveReference(value),
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";
type ProductFamilyCode="hpm"|"guidebook_studio"|"furnishing"|"investment_intelligence";type CapabilityCode="hpm.workspace.access"|"hpm.property.create"|"hpm.performance.view"|"report.standard.generate"|"report.owner_safe.generate"|"report.pdf.export"|"report.csv.export"|"hpm.action.manage"|"guidebook.workspace.access"|"guidebook.property.create_standalone"|"guidebook.create"|"guidebook.preview"|"guidebook.publish"|"furnishing.project.access"|"furnishing.intake.submit"|"furnishing.requirements.manage"|"furnishing.budget.capture"|"furnishing.selection.review"|"furnishing.approval.manage"|"furnishing.status.view"|"furnishing.deliverable.view"|"investment.analysis.run"|"investment.opportunity.save"|"investment.analysis.rerun"|"investment.market.view"|"investment.report.generate";
import type { OnboardingCase, OnboardingModuleInstance } from "../domain";
import type { ProductProvisioningResult } from "../application";

type Row = Record<string, unknown>;

const capabilityFor: Readonly<Record<ProductFamilyCode, CapabilityCode>> = Object.freeze({
  hpm: "hpm.workspace.access",
  guidebook_studio: "guidebook.create",
  furnishing: "furnishing.project.access",
  investment_intelligence: "investment.analysis.run",
});

function mapCase(row: Row): OnboardingCase {
  return Object.freeze({
    id: String(row.id), tenantId: String(row.tenant_id), customerAccountId: String(row.customer_account_id),
    sourceType: row.source_type as OnboardingCase["sourceType"], sourceReferenceId: String(row.source_reference_id),
    status: row.status as OnboardingCase["status"], planVersion: Number(row.plan_version),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), revision: Number(row.revision),
  });
}

function mapModule(row: Row): OnboardingModuleInstance {
  return Object.freeze({
    id: String(row.id), onboardingCaseId: String(row.onboarding_case_id), moduleCode: String(row.module_code),
    moduleVersion: Number(row.module_version), ...(row.product_family ? { productFamily: row.product_family as ProductFamilyCode } : {}),
    status: row.status as OnboardingModuleInstance["status"], responsibility: row.responsibility as OnboardingModuleInstance["responsibility"],
    required: Boolean(row.required), sequence: Number(row.sequence), revision: Number(row.revision),
  });
}

export class SupabaseOnboardingProvisioningState {
  constructor(private readonly client: SupabaseClient) {}

  async authorize(input: Readonly<{actorId:string;tenantId:string;customerAccountId:string;caseId:string}>) {
    const { data, error } = await this.client.rpc("authorize_onboarding_product_provisioning", {
      p_actor_id: input.actorId, p_tenant_id: input.tenantId, p_customer_account_id: input.customerAccountId,
      p_onboarding_case_id: input.caseId,
    });
    if (error) throw new Error("ONBOARDING_PROVISIONING_AUTHORIZATION_FAILED");
    return data === true;
  }

  async evaluateEntitlement(input: Readonly<{actorId:string;tenantId:string;customerAccountId:string;capability:CapabilityCode}>) {
    const expectedFamily = (Object.entries(capabilityFor).find(([, value]) => value === input.capability)?.[0]) as ProductFamilyCode | undefined;
    if (!expectedFamily) return { allowed:false as const, capability:input.capability, reason:"unknown_capability"as const };
    const { data, error } = await this.client.from("commercial_entitlements").select("id,source,status,effective_from,effective_until")
      .eq("tenant_id", input.tenantId).eq("customer_account_id", input.customerAccountId).eq("capability_code", input.capability)
      .eq("status", "active").lte("effective_from", new Date().toISOString()).order("effective_from", { ascending:false }).limit(1).maybeSingle();
    if (error) throw new Error("ENTITLEMENT_EVALUATION_FAILED");
    if (!data || (data.effective_until && Date.parse(String(data.effective_until)) <= Date.now())) return { allowed:false as const, capability:input.capability, reason:"not_entitled"as const };
    return { allowed:true as const, capability:input.capability, entitlementId:String(data.id), source:data.source as "offer_activation"|"subscription"|"service_engagement"|"administrative_grant"|"migration" };
  }

  async loadCase(caseId:string) {
    const [{data:caseRow,error:caseError},{data:moduleRows,error:moduleError}] = await Promise.all([
      this.client.from("onboarding_cases").select("*").eq("id", caseId).maybeSingle(),
      this.client.from("onboarding_module_instances").select("*").eq("onboarding_case_id", caseId).order("sequence"),
    ]);
    if (caseError || moduleError) throw new Error("ONBOARDING_PROVISIONING_STATE_FAILED");
    return caseRow ? Object.freeze({ case:mapCase(caseRow as Row), modules:Object.freeze((moduleRows ?? []).map(row => mapModule(row as Row))) }) : null;
  }

  async checkLimit(input: Readonly<{tenantId:string;customerAccountId:string;productFamily:ProductFamilyCode}>) {
    const { data, error } = await this.client.rpc("onboarding_product_limit_available", {
      p_tenant_id: input.tenantId, p_customer_account_id: input.customerAccountId, p_product_family: input.productFamily,
    });
    if (error) throw new Error("PRODUCT_LIMIT_EVALUATION_FAILED");
    return data === true;
  }

  async findExisting(caseId:string, family:ProductFamilyCode): Promise<ProductProvisioningResult|null> {
    const { data, error } = await this.client.from("activation_product_contexts").select("context_type,context_id,artifact_reference_id")
      .eq("onboarding_case_id", caseId).eq("product_family", family).maybeSingle();
    if (error) throw new Error("PRODUCT_CONTEXT_READ_FAILED");
    return data ? Object.freeze({ contextType:String(data.context_type) as ProductProvisioningResult["contextType"], contextId:String(data.context_id), firstValueReferenceId:String(data.artifact_reference_id) }) : null;
  }

  async saveReference(input: Readonly<{caseId:string;tenantId:string;family:ProductFamilyCode;result:ProductProvisioningResult;relationship:"created"|"linked";correlationId:string}>) {
    const { error } = await this.client.rpc("record_onboarding_product_reference", {
      p_onboarding_case_id: input.caseId, p_tenant_id: input.tenantId, p_product_family: input.family,
      p_context_type: input.result.contextType, p_context_id: input.result.contextId, p_relationship: input.relationship,
      p_correlation_id: input.correlationId,
    });
    if (error) throw new Error("PRODUCT_CONTEXT_REFERENCE_FAILED");
  }
}

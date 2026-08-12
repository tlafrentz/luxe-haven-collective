import type { SupabaseClient } from "@supabase/supabase-js";
import type { FirstValueAuthorization, ProductContext } from "../application";
import type { FirstValueJourney } from "../domain";

const capability = { hpm:"hpm.workspace.access", guidebook:"guidebook.create", furnishing:"furnishing.project.access", investment_intelligence:"investment.analysis.run" } as const;
const contextFamily = { hpm:"hpm", guidebook:"guidebook_studio", furnishing:"furnishing", investment_intelligence:"investment_intelligence" } as const;
const destinations = { hpm:"/dashboard/hpm", guidebook:"/dashboard/guidebooks", furnishing:"/dashboard/furnishing/projects", investment_intelligence:"/dashboard/investments" } as const;

export class SupabaseFirstValueAuthorization implements FirstValueAuthorization {
  constructor(private readonly client:SupabaseClient) {}
  private async authorized(actorId:string, tenantId:string, customerAccountId:string) {
    const [{data:profile,error:profileError},{data:membership,error:membershipError}] = await Promise.all([
      this.client.from("profiles").select("role").eq("id", actorId).maybeSingle(),
      this.client.from("customer_account_memberships").select("id").eq("profile_id", actorId).eq("tenant_id", tenantId).eq("customer_account_id", customerAccountId).eq("status", "active").maybeSingle(),
    ]);
    if (profileError || membershipError) throw new Error("FIRST_VALUE_AUTHORIZATION_FAILED");
    return profile?.role === "admin" || Boolean(membership);
  }
  async authorizeEntry(input:Readonly<{actorId:string;tenantId:string;customerAccountId:string;onboardingCaseId?:string;productFamily:FirstValueJourney["productFamily"]}>) {
    if (!await this.authorized(input.actorId,input.tenantId,input.customerAccountId)) return false;
    if (!input.onboardingCaseId) return true;
    const {data,error}=await this.client.from("onboarding_cases").select("id").eq("id",input.onboardingCaseId).eq("tenant_id",input.tenantId).eq("customer_account_id",input.customerAccountId).maybeSingle();
    if(error)throw new Error("FIRST_VALUE_HANDOFF_READ_FAILED");return Boolean(data);
  }
  authorizeJourney(actorId:string,journey:FirstValueJourney){return this.authorized(actorId,journey.tenantId,journey.customerAccountId)}
  async evaluateEntitlement(input:Readonly<{actorId:string;tenantId:string;customerAccountId:string;family:FirstValueJourney["productFamily"]}>) {
    if(!await this.authorized(input.actorId,input.tenantId,input.customerAccountId))return{allowed:false as const,capability:capability[input.family],reason:"not_authorized"as const};
    const{data,error}=await this.client.from("commercial_entitlements").select("id,source,effective_until").eq("tenant_id",input.tenantId).eq("customer_account_id",input.customerAccountId).eq("capability_code",capability[input.family]).eq("status","active").lte("effective_from",new Date().toISOString()).order("effective_from",{ascending:false}).limit(1).maybeSingle();
    if(error)throw new Error("ENTITLEMENT_EVALUATION_FAILED");if(!data||(data.effective_until&&Date.parse(String(data.effective_until))<=Date.now()))return{allowed:false as const,capability:capability[input.family],reason:"not_entitled"as const};
    return{allowed:true as const,capability:capability[input.family],entitlementId:String(data.id),source:data.source as "offer_activation"|"subscription"|"service_engagement"|"administrative_grant"|"migration"};
  }
  async evaluateHandoff(actorId:string,caseId:string,family:FirstValueJourney["productFamily"]){
    const{data:caseRow,error:caseError}=await this.client.from("onboarding_cases").select("tenant_id,customer_account_id,status").eq("id",caseId).maybeSingle();if(caseError||!caseRow||!await this.authorized(actorId,String(caseRow.tenant_id),String(caseRow.customer_account_id)))return{ready:false as const,code:"CONFIGURATION_INVALID"as const};
    const{data:modules,error}=await this.client.from("onboarding_module_instances").select("status,required,responsibility,product_family").eq("onboarding_case_id",caseId);if(error)return{ready:false as const,code:"CONFIGURATION_INVALID"as const};
    const dbFamily=contextFamily[family],incomplete=(modules??[]).some(value=>value.required&&value.product_family===dbFamily&&value.responsibility!=="system"&&!['verified','skipped'].includes(String(value.status)));
    if(incomplete)return{ready:false as const,code:"REQUIRED_MODULE_INCOMPLETE"as const};
    const{data:context}=await this.client.from("activation_product_contexts").select("id").eq("onboarding_case_id",caseId).eq("product_family",dbFamily).maybeSingle();return context?{ready:true as const,code:"READY"as const}:{ready:false as const,code:"PRODUCT_CONTEXT_MISSING"as const};
  }
  async resolveContext(input:Readonly<{tenantId:string;customerAccountId:string;onboardingCaseId?:string;family:FirstValueJourney["productFamily"]}>):Promise<ProductContext|null>{
    let query=this.client.from("activation_product_contexts").select("context_type,context_id,artifact_reference_id,tenant_id,customer_account_id").eq("tenant_id",input.tenantId).eq("customer_account_id",input.customerAccountId).eq("product_family",contextFamily[input.family]);if(input.onboardingCaseId)query=query.eq("onboarding_case_id",input.onboardingCaseId);const{data,error}=await query.order("created_at",{ascending:false}).limit(1).maybeSingle();if(error)throw new Error("PRODUCT_CONTEXT_READ_FAILED");return data?{type:String(data.context_type),id:String(data.context_id),tenantId:String(data.tenant_id),customerAccountId:String(data.customer_account_id),usableExistingArtifact:{id:String(data.artifact_reference_id),type:input.family,status:"candidate"}}:null;
  }
  async authorizeDestination(actorId:string,journey:FirstValueJourney,destination:string){return destination===destinations[journey.productFamily]&&await this.authorized(actorId,journey.tenantId,journey.customerAccountId)}
}

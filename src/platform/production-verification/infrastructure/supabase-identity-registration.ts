import type { SupabaseClient } from "@supabase/supabase-js";
import type { ControlledIdentityRegistrationRepository, IdentityRegistrationAuthorization, VerificationIdentityRegistration } from "../application/identity";

export class SupabaseControlledIdentityRegistrationRepository implements ControlledIdentityRegistrationRepository {
  constructor(private readonly client: SupabaseClient) {}
  async resolveAuthSubject(reference: string) {
    const { data: auth, error: authError }=await this.client.auth.admin.getUserById(reference);if(authError||!auth.user)return null;
    const { data: profile, error: profileError }=await this.client.from("profiles").select("role").eq("id",reference).maybeSingle();if(profileError)throw new Error("CONTROLLED_IDENTITY_PROFILE_READ_FAILED");
    const { data: memberships, error: membershipError }=await this.client.from("customer_account_memberships").select("tenant_id").eq("profile_id",reference).eq("status","active");if(membershipError)throw new Error("CONTROLLED_IDENTITY_MEMBERSHIP_READ_FAILED");
    return { actorId: reference, active: !auth.user.banned_until, roles: profile?.role?[String(profile.role)]:[], tenantIds: [...new Set((memberships??[]).map(value=>String(value.tenant_id)))] };
  }
  async find(reference: string) {
    const { data,error }=await this.client.from("controlled_verification_identities").select("fingerprint").eq("opaque_auth_subject_reference",reference).maybeSingle();if(error)throw new Error("CONTROLLED_IDENTITY_READ_FAILED");return data?{fingerprint:String(data.fingerprint)}:null;
  }
  async register(input: VerificationIdentityRegistration & { fingerprint: string }, actorId: string, correlationId: string) {
    const { error }=await this.client.from("controlled_verification_identities").insert({environment_code:"production",identity_type_code:input.identityTypeCode,opaque_auth_subject_reference:input.opaqueAuthSubjectReference,tenant_id:input.tenantId??null,customer_account_id:input.customerAccountId??null,allowed_scenario_codes:[...input.allowedScenarioCodes],status:"active",expires_at:input.expiresAt.toISOString(),created_under_policy_code:"CA001F_CONTROLLED_IDENTITY_V1",fingerprint:input.fingerprint,fixture_ownership_code:input.fixtureOwnershipCode,retention_classification:input.retentionClassification,registered_by:actorId,registration_correlation_id:correlationId});
    if(error)throw new Error("CONTROLLED_IDENTITY_REGISTRATION_FAILED");
  }
}

export class SupabaseIdentityRegistrationAuthorization implements IdentityRegistrationAuthorization {
  constructor(private readonly client: SupabaseClient) {}
  async authorize(actorId: string) { const {data,error}=await this.client.from("profiles").select("role").eq("id",actorId).maybeSingle();if(error)throw new Error("CONTROLLED_IDENTITY_AUTHORIZATION_FAILED");return data?.role==="admin"||data?.role==="administrator"; }
}

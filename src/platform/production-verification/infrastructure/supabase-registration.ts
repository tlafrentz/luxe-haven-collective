import type { SupabaseClient } from "@supabase/supabase-js";
import type { DefinitionRegistrationAuthorization, PublishedDefinition, VerificationDefinitionRepository } from "../application/registration";

const tableFor = (kind: string) => kind === "plan" ? "production_verification_plans" : kind === "scenario" ? "production_verification_scenarios" : kind === "evidence" ? "production_verification_evidence_definitions" : "production_verification_policy_definitions";

export class SupabaseVerificationDefinitionRepository implements VerificationDefinitionRepository {
  constructor(private readonly client: SupabaseClient) {}
  async find(kind: string, code: string, version: number) {
    const { data, error } = await this.client.from(tableFor(kind)).select("fingerprint,status").eq("code", code).eq("version", version).maybeSingle();
    if (error) throw new Error("VERIFICATION_REGISTRY_READ_FAILED");
    return data ? { fingerprint: String(data.fingerprint), status: String(data.status) } : null;
  }
  async publish(value: PublishedDefinition, actorId: string) {
    const row = value.kind === "plan" ? { code: value.code, version: value.version, status: "active", fingerprint: value.fingerprint, definition: value.definition, published_at: new Date().toISOString() }
      : value.kind === "scenario" || value.kind === "evidence" ? { code: value.code, version: value.version, status: "active", fingerprint: value.fingerprint, definition: value.definition }
      : { kind: value.kind, code: value.code, version: value.version, status: "active", fingerprint: value.fingerprint, definition: value.definition, published_at: new Date().toISOString() };
    const { error } = await this.client.from(tableFor(value.kind)).insert({ ...row, registered_by: actorId });
    if (error) throw new Error("VERIFICATION_REGISTRY_PUBLISH_FAILED");
  }
}

export class SupabaseDefinitionRegistrationAuthorization implements DefinitionRegistrationAuthorization {
  constructor(private readonly client: SupabaseClient) {}
  async authorizeRegistration(actorId: string) {
    const { data, error } = await this.client.from("profiles").select("role").eq("id", actorId).maybeSingle();
    if (error) throw new Error("VERIFICATION_REGISTRATION_AUTHORIZATION_FAILED");
    return data?.role === "admin" || data?.role === "administrator";
  }
}

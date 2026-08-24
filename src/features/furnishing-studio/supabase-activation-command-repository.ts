import type { SupabaseClient } from "@supabase/supabase-js";
import type { FurnishingActivationCommandRepository, FurnishingAuditEvent, FurnishingControlRecord, FurnishingControlTarget, FurnishingCommandResult } from "./admin-activation-commands";

/** Production adapter: all writes go through the authenticated transactional RPC. */
export function createSupabaseFurnishingActivationRepository(client: SupabaseClient): FurnishingActivationCommandRepository {
  return {
    async read(target, targetId) { const table = target === "global" ? "furnishing_activation_releases" : target === "workspace" ? "furnishing_activation_workspaces" : target === "capability" ? "furnishing_activation_capabilities" : "furnishing_activation_cohorts"; const { data, error } = await client.from(table).select("*").eq(target === "global" ? "milestone" : "id", target === "global" ? "FS-008A" : targetId).maybeSingle(); if (error || !data) return null; return { target, targetId, state: String(data.state ?? data.global_state ?? (data.enabled ? "limited" : "disabled")) as FurnishingControlRecord["state"], version: Number(data.optimistic_version ?? data.version ?? 1), ...(data.workspace_id ? { tenantId: String(data.workspace_id) } : {}) }; },
    async tenantOwnsTarget(target, targetId, tenantId) { if (target === "global") return true; if (!tenantId) return false; const table = target === "workspace" ? "furnishing_activation_workspaces" : target === "cohort" ? "furnishing_activation_cohorts" : "furnishing_activation_capabilities"; const { data } = await client.from(table).select("id").eq("id", targetId).eq("workspace_id", tenantId).maybeSingle(); return Boolean(data); },
    async findIdempotency(key) { const { data } = await client.from("furnishing_activation_audit_events").select("metadata").eq("idempotency_key", key).maybeSingle(); const value = data?.metadata as any; return value?.fingerprint && value?.result ? { fingerprint: String(value.fingerprint), result: value.result as FurnishingCommandResult } : null; },
    async commit(input) { const { error } = await client.rpc("apply_furnishing_activation_control", { p_before: input.before, p_after: input.after, p_audit: input.audit, p_fingerprint: input.fingerprint }); if (error) throw new Error("ACTIVATION_REPOSITORY_UNAVAILABLE"); },
  };
}

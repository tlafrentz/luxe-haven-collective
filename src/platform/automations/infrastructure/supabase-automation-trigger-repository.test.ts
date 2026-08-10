import { describe, expect, it } from "vitest";
import { SupabaseAutomationTriggerRepository, SupabaseSchedulerCoordinationRepository, type TriggerSupabaseClient, type TriggerSupabaseQuery } from "./supabase-automation-trigger-repository";
import type { TriggerActivity } from "../application/automation-trigger-processing";
import type { AutomationRunRequest, TriggerOccurrence } from "../domain/automation-triggering";

const tenant = "11111111-1111-4111-8111-111111111111", actor = "22222222-2222-4222-8222-222222222222", at = "2026-08-10T12:00:00Z";
const triggerRow = { id: "trigger-1", automation_id: "automation-1", automation_definition_version: 1, workspace_id: tenant, kind: "MANUAL", schema_version: "au001-trigger.v1", scope_type: "property", property_ids: ["property-1"], enabled: true, effective_from: "2026-01-01T00:00:00Z", configuration: {}, misfire_policy: "SKIP", backfill_maximum_count: 10, backfill_maximum_age_ms: 604800000, deduplication_policy_version: "au001-occurrence.v1", eligibility_policy_version: "au001-eligibility.v1", created_by_profile_id: actor, updated_by_profile_id: actor, created_at: at, updated_at: at, version: 1 };
const occurrence: TriggerOccurrence = { id: "occurrence-1", occurrenceKey: "stable", tenantId: tenant, automationId: "automation-1", automationDefinitionVersion: 1, triggerId: "trigger-1", triggerKind: "MANUAL", targetKey: "property-1", occurredAt: at, detectedAt: at, disposition: "ACCEPTED", reasonCode: "TRIGGER_ELIGIBLE", correlationId: "c", sourceIdentity: "manual:1", safeContext: {}, eligibilityPolicyVersion: "au001-eligibility.v1", backfilled: false, version: 1 };
const run: AutomationRunRequest = { id: "run-1", idempotencyKey: "run:stable", tenantId: tenant, scope: { type: "property", propertyIds: ["property-1"] }, automationId: "automation-1", automationDefinitionVersion: 1, triggerId: "trigger-1", triggerKind: "MANUAL", occurrenceId: occurrence.id, requestedAt: at, occurredAt: at, eligibilityPolicyVersion: "au001-eligibility.v1", approvalClassification: "before-run", correlationId: "c", safeTriggerContext: {}, status: "REQUESTED", version: 1 };
const activity: TriggerActivity = { id: "activity-1", tenantId: tenant, automationId: "automation-1", triggerId: "trigger-1", occurrenceId: occurrence.id, eventType: "accepted", actorId: actor, occurredAt: at, correlationId: "c", aggregateVersion: 1, safeMetadata: {} };

class Query implements TriggerSupabaseQuery {
  public constructor(private readonly values: Record<string, unknown>[]) {}
  select() { return this; } eq(column: string, value: unknown) { return new Query(this.values.filter((row) => row[column] === value)); } order() { return this; } limit(count: number) { return new Query(this.values.slice(0, count)); }
  maybeSingle() { return Promise.resolve({ data: this.values[0] ?? null, error: null }); }
  then<TResult1, TResult2 = never>(onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) { return Promise.resolve({ data: this.values, error: null }).then(onfulfilled, onrejected); }
}
class Client implements TriggerSupabaseClient {
  public calls: Array<{ name: string; parameters: Readonly<Record<string, unknown>> }> = [];
  public constructor(private readonly error: { code?: string; message: string } | null = null) {}
  from(table: string) { return new Query(table === "automation_triggers" ? [triggerRow] : []); }
  rpc(name: string, parameters: Readonly<Record<string, unknown>>) { this.calls.push({ name, parameters }); const data = name === "accept_automation_trigger_occurrence" ? { created: true, occurrence: parameters.p_occurrence, runRequest: parameters.p_run_request } : name === "claim_automation_scheduler_lease" ? { partition_key: "p", owner_id: "worker", generation: 1, acquired_at: at, expires_at: "2026-08-10T12:01:00Z", heartbeat_at: at, progress: 0 } : triggerRow; return Promise.resolve({ data, error: this.error }); }
}

describe("Supabase AU-001B repositories", () => {
  it("maps RLS-filtered trigger definitions", async () => {
    expect(await new SupabaseAutomationTriggerRepository(new Client()).getTrigger(tenant, "trigger-1")).toMatchObject({ id: "trigger-1", kind: "MANUAL", schemaVersion: "au001-trigger.v1" });
  });
  it("atomically persists one occurrence, run request, and activity batch", async () => {
    const client = new Client(), repository = new SupabaseAutomationTriggerRepository(client); const result = await repository.accept({ occurrence, runRequest: run, activity: [activity] });
    expect(result).toMatchObject({ created: true, occurrence: { id: occurrence.id }, runRequest: { id: run.id } }); expect(client.calls[0].name).toBe("accept_automation_trigger_occurrence");
  });
  it("uses database-backed lease claims", async () => {
    const client = new Client(); expect(await new SupabaseSchedulerCoordinationRepository(client).claimLease({ tenantId: tenant, partitionKey: "p", ownerId: "worker", now: at, durationMs: 60_000 })).toMatchObject({ partitionKey: "p", generation: 1 }); expect(client.calls[0].name).toBe("claim_automation_scheduler_lease");
  });
  it("maps concurrency and access failures without raw infrastructure details", async () => {
    await expect(new SupabaseAutomationTriggerRepository(new Client({ code: "40001", message: "raw sql" })).accept({ occurrence, runRequest: run, activity: [activity] })).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION", message: expect.not.stringContaining("raw") });
    await expect(new SupabaseAutomationTriggerRepository(new Client({ code: "42501", message: "raw rls" })).accept({ occurrence, activity: [activity] })).rejects.toMatchObject({ code: "TRIGGER_ACCESS_DENIED", message: expect.not.stringContaining("raw") });
  });
});

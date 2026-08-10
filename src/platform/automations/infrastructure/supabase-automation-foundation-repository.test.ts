import { describe, expect, it } from "vitest";
import type { AutomationDefinition, AutomationDefinitionVersion } from "../domain/automation-definition";
import { configuration } from "../domain/automation-definition.test";
import { SupabaseAutomationFoundationRepository, type AutomationSupabaseClient, type AutomationSupabaseQuery } from "./supabase-automation-foundation-repository";

const definition: AutomationDefinition = { id: "automation-1", tenantId: "11111111-1111-4111-8111-111111111111", status: "draft", currentVersion: 1, version: 1, createdBy: "22222222-2222-4222-8222-222222222222", createdAt: "2026-08-10T01:00:00.000Z" };
const version: AutomationDefinitionVersion = { id: "version-1", automationId: definition.id, tenantId: definition.tenantId, version: 1, name: "Definition", description: "Description", status: "draft", configuration: { ...configuration, ownerId: definition.createdBy }, schemaVersion: "au001-definition.v1", policyVersion: "au001-foundation.v1", compatibility: "unverified", createdBy: definition.createdBy, createdAt: definition.createdAt, reason: "Initial draft" };
const activity = { id: "activity-1", tenantId: definition.tenantId, automationId: definition.id, definitionVersion: 1, eventType: "automation-draft-created", actorId: definition.createdBy, occurredAt: definition.createdAt, correlationId: "correlation-1", safeMetadata: {} } as const;

class Query implements AutomationSupabaseQuery {
  constructor(private readonly rows: Record<string, unknown>[]) {}
  select() { return this; } eq(column: string, value: unknown) { return new Query(this.rows.filter((row) => row[column] === value)); } order() { return this; }
  maybeSingle() { return Promise.resolve({ data: this.rows[0] ?? null, error: null }); }
  then<TResult1, TResult2 = never>(onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) { return Promise.resolve({ data: this.rows, error: null }).then(onfulfilled, onrejected); }
}
class Client implements AutomationSupabaseClient {
  calls: Array<{ name: string; parameters: Readonly<Record<string, unknown>> }> = [];
  constructor(private readonly rpcError: { code?: string; message: string } | null = null) {}
  from(table: string) { return new Query(table === "automation_definitions" ? [{ id: definition.id, workspace_id: definition.tenantId, status: "draft", current_version: 1, aggregate_version: 1, created_by_profile_id: definition.createdBy, created_at: definition.createdAt }] : [{ id: version.id, automation_id: version.automationId, workspace_id: version.tenantId, version: 1, name: version.name, description: version.description, status: "draft", scope_type: "property", property_ids: ["property-1"], owner_profile_id: definition.createdBy, trigger_specification: configuration.trigger, condition_specifications: [], exclusion_specifications: [], command_specification: configuration.command, approval_policy: configuration.approval, execution_policy: configuration.execution, retry_policy: configuration.retry, notification_policy: configuration.notification, effective_from: configuration.effectiveFrom, compatibility: "unverified", created_by_profile_id: definition.createdBy, created_at: definition.createdAt, reason: version.reason }]); }
  rpc(name: string, parameters: Readonly<Record<string, unknown>>) { this.calls.push({ name, parameters }); return Promise.resolve({ data: {}, error: this.rpcError }); }
}

describe("Supabase AU-001A repository", () => {
  it("reads the RLS-filtered aggregate and current immutable version", async () => {
    const value = await new SupabaseAutomationFoundationRepository(new Client()).get(definition.tenantId, definition.id);
    expect(value).toMatchObject({ definition: { id: definition.id, version: 1 }, current: { id: version.id, schemaVersion: "au001-definition.v1" } });
  });
  it("persists definition, version, activity, and notification intent through one atomic RPC", async () => {
    const client = new Client(), repository = new SupabaseAutomationFoundationRepository(client);
    await repository.appendVersion({ expectedVersion: 1, definition: { ...definition, status: "ready-for-review", currentVersion: 2, version: 2 }, version: { ...version, id: "version-2", version: 2, status: "ready-for-review" }, activity: { ...activity, id: "activity-2", definitionVersion: 2 }, notification: { id: "notice-1", tenantId: definition.tenantId, automationId: definition.id, recipientId: definition.createdBy, eventType: "automation-ready-for-review", idempotencyKey: "stable", safeTemplateVariables: {}, createdAt: definition.createdAt } });
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toMatchObject({ name: "save_automation_definition", parameters: { p_expected_version: 1 } });
  });
  it("maps database concurrency and authorization failures without leaking raw errors", async () => {
    await expect(new SupabaseAutomationFoundationRepository(new Client({ code: "40001", message: "raw sql" })).create({ definition, version, activity })).rejects.toMatchObject({ code: "AUTOMATION_VERSION_CONFLICT", message: expect.not.stringContaining("raw sql") });
    await expect(new SupabaseAutomationFoundationRepository(new Client({ code: "42501", message: "raw rls" })).create({ definition, version, activity })).rejects.toMatchObject({ code: "AUTOMATION_ACCESS_DENIED", message: expect.not.stringContaining("raw rls") });
  });
});

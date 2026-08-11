import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = required("AU_PROVISION_SUPABASE_URL");
const serviceRoleKey = required("AU_PROVISION_SERVICE_ROLE_KEY");
const workspaceId = required("AU_EXECUTE_WORKSPACE_ID");
const propertyId = required("AU_EXECUTE_PROPERTY_ID");
const releaseOwnerId = required("AU_RELEASE_OWNER_PROFILE_ID");
const automationId = "au-internal-draft-plan-v1";
const versionId = "au-internal-draft-plan-v1-version-1";
const manualTriggerId = "au-internal-manual-v1";
const scheduleTriggerId = "au-internal-schedule-v1";
const now = new Date().toISOString();
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { error: definitionError } = await admin
    .from("automation_definitions")
    .insert({
      id: automationId,
      workspace_id: workspaceId,
      status: "active",
      current_version: 1,
      aggregate_version: 1,
      property_ids: [propertyId],
      created_by_profile_id: releaseOwnerId,
      created_at: now,
      activated_by_profile_id: releaseOwnerId,
      activated_at: now,
    });
  assert.equal(definitionError, null);

  const command = {
    owningCapability: "execute",
    commandType: "createDraftPlan",
    contractVersion: "v1",
  };
  const { error: versionError } = await admin
    .from("automation_definition_versions")
    .insert({
      id: versionId,
      automation_id: automationId,
      workspace_id: workspaceId,
      version: 1,
      name: "Internal automation proof draft plan",
      description: "Creates one unassigned draft Execute plan for the approved internal property.",
      status: "active",
      scope_type: "property",
      property_ids: [propertyId],
      owner_profile_id: releaseOwnerId,
      operational_steward_profile_id: releaseOwnerId,
      trigger_specification: { kind: "schedule", schemaVersion: "v1", sourceCapability: "automation", specification: {} },
      condition_specifications: [],
      exclusion_specifications: [],
      command_specification: command,
      approval_policy: { mode: "none", authority: "exact-internal-cohort" },
      execution_policy: { maxFanOut: 1, maxChainDepth: 1, concurrency: "queue" },
      retry_policy: { maxAttempts: 3, timeoutMs: 60_000 },
      notification_policy: { eventTypes: ["run-failed", "reconciliation-required"] },
      effective_from: now,
      valid_until: null,
      schema_version: "au001-definition.v1",
      policy_version: "au001-foundation.v1",
      compatibility: "compatible",
      created_by_profile_id: releaseOwnerId,
      created_at: now,
      reason: "AU-001 bounded internal production proof",
    });
  assert.equal(versionError, null);

  for (const trigger of [
    {
      id: manualTriggerId,
      kind: "MANUAL",
      configuration: {},
    },
    {
      id: scheduleTriggerId,
      kind: "SCHEDULE_CALENDAR",
      configuration: { cadence: "DAILY", localTime: "09:00", timeZone: "America/Chicago" },
    },
  ]) {
    const { error } = await admin.from("automation_triggers").insert({
      id: trigger.id,
      workspace_id: workspaceId,
      automation_id: automationId,
      automation_definition_version: 1,
      kind: trigger.kind,
      schema_version: "au001-trigger.v1",
      scope_type: "property",
      property_ids: [propertyId],
      target_id: propertyId,
      enabled: false,
      effective_from: now,
      effective_until: null,
      configuration: trigger.configuration,
      misfire_policy: "SKIP",
      backfill_maximum_count: 1,
      backfill_maximum_age_ms: 86_400_000,
      deduplication_policy_version: "au001-occurrence.v1",
      eligibility_policy_version: "au001-eligibility.v1",
      created_by_profile_id: releaseOwnerId,
      updated_by_profile_id: releaseOwnerId,
      created_at: now,
      updated_at: now,
      version: 1,
    });
    assert.equal(error, null);
  }

  process.stdout.write(JSON.stringify({ seeded: true, automationId, version: 1, triggerCount: 2, triggersEnabled: false, propertyCount: 1, commandType: "createDraftPlan" }));
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({ seeded: false, classification: error instanceof Error ? error.message : "COHORT_SEED_FAILED" }));
  process.exitCode = 1;
});

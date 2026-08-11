import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  SupabaseAutomationFoundationRepository,
  type AutomationSupabaseClient,
} from "../../src/platform/automations/infrastructure/supabase-automation-foundation-repository";

const url = required("AU_REHEARSAL_SUPABASE_URL"),
  anonKey = required("AU_REHEARSAL_ANON_KEY"),
  serviceRoleKey = required("AU_REHEARSAL_SERVICE_ROLE_KEY"),
  password = "Hosted-Rehearsal-Only-2026!",
  workspaceId = "10000000-0000-0000-0000-000000000001",
  definitionId = "hosted-automation-1";

const client = () =>
  createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

async function authenticated(email: string) {
  const value = client(),
    { error } = await value.auth.signInWithPassword({ email, password });
  assert.equal(error, null, `Authentication failed for ${email}.`);
  return value;
}

async function visibleCount(
  value: Awaited<ReturnType<typeof authenticated>>,
  table: string,
) {
  const { count, error } = await value
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("id", definitionId);
  assert.equal(error, null, `${table} query failed.`);
  return count ?? 0;
}

async function main() {
  const owner = await authenticated("au-owner-1@example.invalid"),
    administrator = await authenticated("au-admin@example.invalid"),
    restricted = await authenticated("au-restricted@example.invalid"),
    otherTenant = await authenticated("au-owner-2@example.invalid"),
    anonymous = client(),
    service = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  assert.equal(await visibleCount(owner, "automation_definitions"), 1);
  assert.equal(await visibleCount(administrator, "automation_definitions"), 1);
  assert.equal(await visibleCount(restricted, "automation_definitions"), 0);
  assert.equal(await visibleCount(otherTenant, "automation_definitions"), 0);
  assert.equal(await visibleCount(anonymous, "automation_definitions"), 0);
  assert.equal(await visibleCount(service, "automation_definitions"), 1);

  const nonAutomationChecks = await Promise.all([
    owner.from("profiles").select("id").eq("id", workspaceId),
    owner.from("owners").select("id").eq("id", workspaceId),
    owner
      .from("workspace_memberships")
      .select("id")
      .eq("workspace_id", workspaceId),
    owner.from("properties").select("id").limit(1),
    owner.from("guidebooks").select("id").limit(1),
  ]);
  for (const result of nonAutomationChecks)
    assert.equal(
      result.error,
      null,
      "An existing non-AU authenticated workflow query failed.",
    );

  const repository = new SupabaseAutomationFoundationRepository(
    owner as unknown as AutomationSupabaseClient,
  );
  const definitions = await repository.list(workspaceId);
  assert.equal(definitions.length, 1);
  assert.equal(definitions[0]?.definition.id, definitionId);

  const { error: immutableError } = await service
    .from("automation_definition_activity")
    .update({ event_type: "tampered" })
    .eq("id", "hosted-automation-activity-1");
  assert.ok(
    immutableError,
    "Service role changed append-only automation history.",
  );

  console.log("AU-001 authenticated hosted Supabase verification passed");
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Hosted verification failed.");
  process.exitCode = 1;
});

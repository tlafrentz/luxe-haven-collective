import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = required("AU_REHEARSAL_SUPABASE_URL"),
  anonKey = required("AU_REHEARSAL_ANON_KEY"),
  serviceRoleKey = required("AU_REHEARSAL_SERVICE_ROLE_KEY"),
  password = "Hosted-Rehearsal-Only-2026!",
  email = "au-owner-1@example.invalid",
  workspaceId = "10000000-0000-0000-0000-000000000001",
  planId = `au-runtime-identity-${Date.now()}`;

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authenticated = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: users, error: userError } = await admin.auth.admin.listUsers();
  assert.equal(userError, null);
  const user = users.users.find((candidate) => candidate.email === email);
  assert.ok(user, "Hosted rehearsal owner was not found.");
  const { data: definition, error: definitionError } = await admin
    .from("automation_definitions")
    .select("property_ids")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .single();
  assert.equal(definitionError, null);
  const propertyId = String(definition.property_ids[0]);
  assert.ok(propertyId);

  const { error: grantError } = await admin
    .from("automation_execute_service_grants")
    .upsert({
      workspace_id: workspaceId,
      profile_id: user.id,
      property_ids: [propertyId],
      command_type: "createDraftPlan",
      active: true,
      created_by_profile_id: user.id,
    });
  assert.equal(grantError, null);
  try {
    const { error: signInError } = await authenticated.auth.signInWithPassword({
      email,
      password,
    });
    assert.equal(signInError, null);
    const now = new Date().toISOString();
    const plan = {
        workspace_id: workspaceId,
        id: planId,
        title: "Automation identity rehearsal",
        origin_type: "manual",
        scope_type: "property",
        property_ids: [propertyId],
        owner_type: "automation",
        owner_id: user.id,
        status: "draft",
        priority: "normal",
        success_metrics: [],
        source_context: {},
        created_by_type: "automation",
        created_by_id: user.id,
        created_at: now,
        updated_at: now,
        version: 1,
      };
    const { error: insertError } = await authenticated.rpc(
      "save_execute_action_plan",
      {
        p_plan: plan,
        p_draft_actions: [],
        p_activity_events: [
          {
            workspace_id: workspaceId,
            id: `${planId}-activity`,
            entity_type: "plan",
            entity_id: planId,
            action_id: null,
            event_type: "plan-created",
            actor_type: "automation",
            actor_id: user.id,
            occurred_at: now,
            metadata: {},
            correlation_id: planId,
            causation_id: null,
          },
        ],
        p_expected_version: null,
      },
    );
    assert.equal(insertError, null, "Draft-plan creation should be allowed.");

    const { data: updatedRows, error: updateError } = await authenticated
      .from("platform_action_plans")
      .update({ title: "Forbidden mutation" })
      .eq("workspace_id", workspaceId)
      .eq("id", planId)
      .select("id");
    assert.ok(
      updateError || !updatedRows?.length,
      "The Execute service identity mutated an existing plan.",
    );

    const { error: actionError } = await authenticated
      .from("platform_actions")
      .insert({
        workspace_id: workspaceId,
        id: `${planId}-action`,
        title: "Forbidden Action",
        status: "draft",
        owner_type: "automation",
        owner_id: user.id,
        property_id: propertyId,
        scope_type: "property",
        priority: "normal",
        schedule_created: now,
        created_at: now,
        created_by_type: "automation",
        created_by_id: user.id,
        updated_at: now,
        version: 1,
      });
    assert.ok(actionError, "The Execute service identity created an Action.");

    const { error: orchestrationError } = await authenticated.rpc(
      "claim_automation_scheduler_lease",
      {
        p_partition_key: "forbidden",
        p_workspace_id: workspaceId,
        p_owner_id: user.id,
        p_now: now,
        p_duration_ms: 60_000,
      },
    );
    assert.ok(orchestrationError, "The Execute identity invoked an AU orchestration RPC.");
    console.log("AU-001 hosted least-privilege runtime identity verification passed");
  } finally {
    await admin
      .from("platform_action_plans")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", planId);
    await admin
      .from("automation_execute_service_grants")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("profile_id", user.id);
  }
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Runtime identity verification failed.");
  process.exitCode = 1;
});

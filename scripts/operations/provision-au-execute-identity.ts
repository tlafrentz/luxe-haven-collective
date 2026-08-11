import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = required("AU_PROVISION_SUPABASE_URL");
const serviceRoleKey = required("AU_PROVISION_SERVICE_ROLE_KEY");
const email = required("AU_EXECUTE_SERVICE_EMAIL");
const password = required("AU_EXECUTE_SERVICE_PASSWORD");
const workspaceId = required("AU_EXECUTE_WORKSPACE_ID");
const propertyId = required("AU_EXECUTE_PROPERTY_ID");
const releaseOwnerId = required("AU_RELEASE_OWNER_PROFILE_ID");

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers();
  assert.equal(listError, null);
  let user = listed.users.find((candidate) => candidate.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Automation Execute Service", role: "guest", non_human: true },
    });
    assert.equal(error, null);
    assert.ok(data.user);
    user = data.user;
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...user.user_metadata, full_name: "Automation Execute Service", role: "guest", non_human: true },
    });
    assert.equal(error, null);
  }

  const { error: membershipError } = await admin
    .from("platform_action_workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id);
  assert.equal(membershipError, null);

  const { error: grantError } = await admin
    .from("automation_execute_service_grants")
    .upsert({
      workspace_id: workspaceId,
      profile_id: user.id,
      property_ids: [propertyId],
      command_type: "createDraftPlan",
      active: true,
      created_by_profile_id: releaseOwnerId,
      revoked_by_profile_id: null,
      revoked_at: null,
    });
  assert.equal(grantError, null);

  process.stdout.write(JSON.stringify({ provisioned: true, userId: user.id, workspaceId, propertyCount: 1, commandType: "createDraftPlan", broadExecuteMembership: false }));
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({ provisioned: false, classification: error instanceof Error ? error.message : "PROVISION_FAILED" }));
  process.exitCode = 1;
});

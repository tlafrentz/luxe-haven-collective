import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
};
const url = required("NEXT_PUBLIC_SUPABASE_URL");
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw new Error("FS008G_LOCAL_SUPABASE_REQUIRED");
const credentialPath = required("FS008G_BROWSER_CREDENTIAL_FILE");
type Fixture = {
  admin: { id: string };
  owner: { id: string };
  workspaceId: string;
  wrongWorkspaceId: string;
  customerAccountId: string;
  propertyId: string;
  styleVersionId: string;
  anonymousProbeProductId: string;
  controlledDesignationId: string;
  controlledRunId: string;
  releaseBaseline: null | {
    id: string;
    globalState: string;
    globalKillSwitch: boolean;
    configurationValid: boolean;
    optimisticVersion: number;
  };
};
const admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function remove(table: string, column: string, value: string) {
  const result = await admin.from(table).delete().eq(column, value);
  if (result.error) throw new Error(`CLEANUP_${table}:${result.error.message}`);
}

async function main() {
  const fixture = JSON.parse(await readFile(credentialPath, "utf8")) as Fixture;
  if (fixture.anonymousProbeProductId) {
    await remove(
      "furnishing_product_identity_claims",
      "product_id",
      fixture.anonymousProbeProductId,
    );
    await remove(
      "furnishing_products",
      "id",
      fixture.anonymousProbeProductId,
    );
  }
  await remove("fsux8_release_permissions", "actor_id", fixture.admin.id);
  await remove(
    "furnishing_activation_workspaces",
    "workspace_id",
    fixture.workspaceId,
  );
  if (fixture.releaseBaseline) {
    if (
      fixture.releaseBaseline.globalState === "disabled" &&
      fixture.releaseBaseline.globalKillSwitch &&
      !fixture.releaseBaseline.configurationValid &&
      fixture.releaseBaseline.optimisticVersion === 1
    ) {
      await remove(
        "furnishing_activation_capabilities",
        "release_id",
        fixture.releaseBaseline.id,
      );
    }
    const restored = await admin
      .from("furnishing_activation_releases")
      .update({
        global_state: fixture.releaseBaseline.globalState,
        global_kill_switch: fixture.releaseBaseline.globalKillSwitch,
        configuration_valid: fixture.releaseBaseline.configurationValid,
        optimistic_version: fixture.releaseBaseline.optimisticVersion,
      })
      .eq("id", fixture.releaseBaseline.id);
    if (restored.error)
      throw new Error(`CLEANUP_RELEASE_BASELINE:${restored.error.message}`);
  }
  if (fixture.customerAccountId) {
    await remove(
      "commercial_entitlements",
      "customer_account_id",
      fixture.customerAccountId,
    );
    await remove(
      "customer_account_memberships",
      "customer_account_id",
      fixture.customerAccountId,
    );
    await remove("customer_accounts", "id", fixture.customerAccountId);
  }
  if (fixture.styleVersionId) {
    const styleVersion = await mustStyleVersion(fixture.styleVersionId);
    if (styleVersion?.style_system_id) {
      const detached = await admin
        .from("furnishing_style_systems")
        .update({ current_version_id: null })
        .eq("id", styleVersion.style_system_id)
        .eq("current_version_id", fixture.styleVersionId);
      if (detached.error)
        throw new Error(
          `CLEANUP_STYLE_CURRENT_VERSION:${detached.error.message}`,
        );
    }
    await remove(
      "furnishing_style_system_versions",
      "id",
      fixture.styleVersionId,
    );
    if (styleVersion?.style_system_id)
      await remove(
        "furnishing_style_systems",
        "id",
        styleVersion.style_system_id,
      );
  }
  if (fixture.propertyId) await remove("properties", "id", fixture.propertyId);
  await remove("workspace_memberships", "workspace_id", fixture.workspaceId);
  const workspace = await admin
    .from("owners")
    .select("id")
    .eq("id", fixture.workspaceId)
    .maybeSingle();
  if (workspace.error)
    throw new Error(`CLEANUP_WORKSPACE_LOOKUP:${workspace.error.message}`);
  if (workspace.data) {
    const cleanup = await admin.rpc("cleanup_fs008g_c8_controlled_tenant", {
      p_workspace_id: fixture.workspaceId,
      p_wrong_workspace_id: fixture.wrongWorkspaceId,
      p_admin_id: fixture.admin.id,
      p_owner_id: fixture.owner.id,
      p_controlled_run_id: fixture.controlledRunId,
    });
    if (cleanup.error)
      throw new Error(`CLEANUP_CONTROLLED_RUN:${cleanup.error.message}`);
  }
  await remove("owners", "id", fixture.workspaceId);
  await remove("owners", "id", fixture.wrongWorkspaceId);
  for (const identity of [fixture.owner, fixture.admin]) {
    const result = await admin.auth.admin.deleteUser(identity.id);
    if (result.error) {
      if (result.error.message === "User not found") continue;
      const retainedActor = await admin
        .from("furnishing_activation_audit_events")
        .select("id", { count: "exact", head: true })
        .eq("actor_id", identity.id);
      if (retainedActor.error || !retainedActor.count)
        throw new Error(`CLEANUP_AUTH_USER:${result.error.message}`);
      const softDeleted = await admin.auth.admin.deleteUser(identity.id, true);
      if (softDeleted.error)
        throw new Error(`CLEANUP_AUTH_USER_SOFT:${softDeleted.error.message}`);
    }
  }
  const checks = await Promise.all([
    admin
      .from("owners")
      .select("id", { count: "exact", head: true })
      .eq("id", fixture.workspaceId),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("id", [fixture.owner.id, fixture.admin.id]),
    ...(fixture.customerAccountId
      ? [
          admin
            .from("customer_accounts")
            .select("id", { count: "exact", head: true })
            .eq("id", fixture.customerAccountId),
        ]
      : []),
  ]);
  if (
    checks.some(
      (result, index) =>
        result.error ||
        (index === 1 ? (result.count ?? 0) > 1 : result.count !== 0),
    )
  )
    throw new Error("FS008G_LOCAL_ZERO_RESOURCE_RECONCILIATION_FAILED");
  process.stdout.write(
    JSON.stringify({
      status: "clean",
      resources: 0,
      retainedImmutableActors: checks[1].count ?? 0,
    }),
  );
}

async function mustStyleVersion(id: string) {
  const result = await admin
    .from("furnishing_style_system_versions")
    .select("style_system_id")
    .eq("id", id)
    .maybeSingle<{ style_system_id: string }>();
  if (result.error)
    throw new Error(`CLEANUP_STYLE_VERSION_LOOKUP:${result.error.message}`);
  return result.data;
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});

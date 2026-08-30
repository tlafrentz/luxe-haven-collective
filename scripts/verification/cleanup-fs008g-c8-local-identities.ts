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
  const designation = await admin.rpc("cleanup_fs008g_c8_controlled_tenant", {
    p_workspace_id: fixture.workspaceId,
    p_admin_id: fixture.admin.id,
    p_owner_id: fixture.owner.id,
  });
  if (designation.error) throw new Error(`CLEANUP_DESIGNATION:${designation.error.message}`);
  if (fixture.customerAccountId) {
    await remove("commercial_entitlements", "customer_account_id", fixture.customerAccountId);
    await remove("customer_account_memberships", "customer_account_id", fixture.customerAccountId);
    await remove("customer_accounts", "id", fixture.customerAccountId);
  }
  await remove("workspace_memberships", "workspace_id", fixture.workspaceId);
  await remove("owners", "id", fixture.workspaceId);
  for (const identity of [fixture.owner, fixture.admin]) {
    const result = await admin.auth.admin.deleteUser(identity.id);
    if (result.error) throw new Error(`CLEANUP_AUTH_USER:${result.error.message}`);
  }
  const checks = await Promise.all([
    admin.from("owners").select("id", { count: "exact", head: true }).eq("id", fixture.workspaceId),
    admin.from("profiles").select("id", { count: "exact", head: true }).in("id", [fixture.owner.id, fixture.admin.id]),
    ...(fixture.customerAccountId ? [admin.from("customer_accounts").select("id", { count: "exact", head: true }).eq("id", fixture.customerAccountId)] : []),
  ]);
  if (checks.some((result) => result.error || result.count !== 0))
    throw new Error("FS008G_LOCAL_ZERO_RESOURCE_RECONCILIATION_FAILED");
  process.stdout.write(JSON.stringify({ status: "clean", resources: 0 }));
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const outputDirectory = required("FS008G_BROWSER_SECRET_DIR");
const candidateCommit = required("FS008G_CANDIDATE_COMMIT");
const parsed = new URL(url);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname))
  throw new Error("FS008G_LOCAL_SUPABASE_REQUIRED");

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const suffix = randomUUID();
const password = () => `C8!${randomBytes(24).toString("base64url")}`;
const credentials = {
  admin: {
    email: `fs008g-c8-admin-${suffix}@example.invalid`,
    password: password(),
    id: "",
  },
  owner: {
    email: `fs008g-c8-owner-${suffix}@example.invalid`,
    password: password(),
    id: "",
  },
  workspaceId: "",
  wrongWorkspaceId: "",
  customerAccountId: "",
  propertyId: "",
  styleVersionId: "",
  controlledRunId: randomUUID(),
  controlledCorrelationId: randomUUID(),
  controlledDesignationId: "",
  candidateCommit,
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

async function must<T>(
  promise: PromiseLike<{ data: T; error: unknown }>,
  code: string,
) {
  const result = await promise;
  if (result.error) throw new Error(`${code}:${JSON.stringify(result.error)}`);
  return result.data;
}

async function createIdentity(
  persona: "admin" | "owner",
  role: "admin" | "owner",
) {
  const identity = credentials[persona];
  const created = await admin.auth.admin.createUser({
    email: identity.email,
    password: identity.password,
    email_confirm: true,
    user_metadata: { full_name: `FS008G C8 Controlled ${persona}`, role },
  });
  if (created.error || !created.data.user)
    throw created.error ?? new Error(`${persona.toUpperCase()}_CREATE_FAILED`);
  identity.id = created.data.user.id;
  await must(
    admin.from("profiles").upsert({
      id: identity.id,
      email: identity.email,
      full_name: `FS008G C8 Controlled ${persona}`,
      role,
    }),
    `${persona.toUpperCase()}_PROFILE`,
  );
}

async function purgeLocalOrphans() {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw listed.error;
  const orphans = listed.data.users.filter((user) =>
    user.email?.startsWith("fs008g-c8-") && user.email.endsWith("@example.invalid"));
  for (const orphan of orphans) {
    await admin.from("workspace_memberships").delete().eq("profile_id", orphan.id);
    await admin.from("owners").delete().eq("profile_id", orphan.id);
    const removed = await admin.auth.admin.deleteUser(orphan.id);
    if (removed.error) throw removed.error;
  }
}

async function provision() {
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await chmod(outputDirectory, 0o700);
  await purgeLocalOrphans();
  await createIdentity("admin", "admin");
  await createIdentity("owner", "owner");

  const existingOwner = await must(
    admin.from("owners").select("id").eq("profile_id", credentials.owner.id).maybeSingle(),
    "OWNER_LOOKUP",
  ) as { id: string } | null;
  const workspace = existingOwner ?? await must(
    admin.from("owners").insert({
      profile_id: credentials.owner.id,
      company_name: `FS008G C8 ${suffix}`,
    }).select("id").single(),
    "WORKSPACE_CREATE",
  ) as { id: string };
  credentials.workspaceId = workspace.id;

  const wrongWorkspace = await must(
    admin.from("owners").insert({ profile_id: credentials.admin.id, company_name: `FS008G C8 Nonmember ${suffix}` }).select("id").single(),
    "WRONG_WORKSPACE_CREATE",
  ) as { id: string };
  credentials.wrongWorkspaceId = wrongWorkspace.id;

  await must(admin.from("workspace_memberships").upsert([
    { workspace_id: workspace.id, profile_id: credentials.owner.id, role: "owner", status: "active", property_access_mode: "all", joined_at: new Date().toISOString() },
    { workspace_id: workspace.id, profile_id: credentials.admin.id, role: "administrator", status: "active", property_access_mode: "all", joined_at: new Date().toISOString() },
  ], { onConflict: "workspace_id,profile_id" }), "WORKSPACE_MEMBERSHIPS");
  await must(admin.rpc("provision_fs008g_c8_controlled_tenant", {
    p_workspace_id: workspace.id,
    p_admin_id: credentials.admin.id,
    p_owner_id: credentials.owner.id,
  }), "CONTROLLED_TENANT_DESIGNATION");
  const designation = await must(admin.rpc("designate_fs008g_controlled_project", {
    p_input: {
      workspace_id: workspace.id,
      controlled_run_id: credentials.controlledRunId,
      correlation_id: credentials.controlledCorrelationId,
      candidate_commit: candidateCommit,
      purpose: "FS-008G C8 controlled lifecycle verification",
      created_by: credentials.owner.id,
      expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    },
  }), "CONTROLLED_RUN_CREATE") as { designationId: string };
  credentials.controlledDesignationId = designation.designationId;
  const customerAccount = await must(admin.from("customer_accounts").insert({
    tenant_id: workspace.id,
    account_type: "owner",
    status: "active",
  }).select("id").single(), "CUSTOMER_ACCOUNT_FIXTURE") as { id: string };
  credentials.customerAccountId = customerAccount.id;
  await must(admin.from("customer_account_memberships").insert({
    tenant_id: workspace.id,
    customer_account_id: customerAccount.id,
    profile_id: credentials.owner.id,
    status: "active",
  }), "CUSTOMER_ACCOUNT_MEMBERSHIP_FIXTURE");
  const release = await must(admin.from("furnishing_activation_releases")
    .select("id,global_state,global_kill_switch,configuration_valid")
    .eq("milestone", "FS-008A").single(), "ACTIVATION_BASELINE_LOOKUP") as {
      id: string; global_state: string; global_kill_switch: boolean; configuration_valid: boolean;
    };
  await must(admin.from("furnishing_activation_releases").update({
    global_state: "internal", global_kill_switch: false, configuration_valid: true,
  }).eq("id", release.id), "LOCAL_ENTITLEMENT_WINDOW_OPEN");
  try {
    await must(admin.from("commercial_entitlements").insert({
      tenant_id: workspace.id,
      customer_account_id: customerAccount.id,
      capability_code: "furnishing.project.access",
      resource_scope_type: "workspace",
      resource_scope_id: workspace.id,
      source: "migration",
      source_reference_id: `fs008g-c8-local-${suffix}`,
      offer_code: "FS-DESIGN",
      offer_version: 1,
      status: "active",
      effective_from: new Date().toISOString(),
    }), "FURNISHING_ENTITLEMENT_FIXTURE");
  } finally {
    await must(admin.from("furnishing_activation_releases").update({
      global_state: release.global_state,
      global_kill_switch: release.global_kill_switch,
      configuration_valid: release.configuration_valid,
    }).eq("id", release.id), "LOCAL_ENTITLEMENT_WINDOW_RESTORE");
  }
  const property = await must(admin.from("properties").insert({
    owner_id: workspace.id,
    name: `FS008G C8 Isolated Property ${suffix}`,
    slug: `fs008g-c8-${suffix}`,
    description: "Isolated browser fixture",
    address_line_1: "800 Local Test Way",
    city: "Austin",
    state: "TX",
    postal_code: "78701",
    country: "US",
    property_type: "short_term_rental",
    timezone: "America/Chicago",
    bedrooms: 2,
    bathrooms: 2,
    max_guests: 6,
    status: "draft",
    source: "manual",
  }).select("id").single(), "PROPERTY_FIXTURE") as { id: string };
  credentials.propertyId = property.id;
  const style = await must(admin.from("furnishing_style_systems").insert({ workspace_id: workspace.id, name: "C8-D Controlled Style", slug: `c8d-${suffix}`, description: "Isolated fixture", scope: "workspace", lifecycle_status: "approved", created_by: credentials.admin.id }).select("id").single(), "STYLE_FIXTURE") as { id: string };
  const styleVersion = await must(admin.from("furnishing_style_system_versions").insert({ style_system_id: style.id, version_number: 1, lifecycle_status: "approved", design_principles: ["durable"], mood_tags: ["controlled"], created_by: credentials.admin.id, approved_by: credentials.admin.id, approved_at: new Date().toISOString() }).select("id").single(), "STYLE_VERSION_FIXTURE") as { id: string };
  credentials.styleVersionId = styleVersion.id;
  await must(admin.from("furnishing_style_systems").update({ current_version_id: styleVersion.id }).eq("id", style.id), "STYLE_CURRENT_VERSION");

  const path = `${outputDirectory}/credentials.json`;
  await writeFile(path, `${JSON.stringify(credentials)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
  process.stdout.write(JSON.stringify({ credentialPath: path, workspaceId: workspace.id }));
}

void provision().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const outputDirectory = required("FS008G_BROWSER_SECRET_DIR");
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

  await must(admin.from("workspace_memberships").upsert([
    { workspace_id: workspace.id, profile_id: credentials.owner.id, role: "owner", status: "active", property_access_mode: "all", joined_at: new Date().toISOString() },
    { workspace_id: workspace.id, profile_id: credentials.admin.id, role: "administrator", status: "active", property_access_mode: "all", joined_at: new Date().toISOString() },
  ], { onConflict: "workspace_id,profile_id" }), "WORKSPACE_MEMBERSHIPS");

  credentials.wrongWorkspaceId = randomUUID();

  const path = `${outputDirectory}/credentials.json`;
  await writeFile(path, `${JSON.stringify(credentials)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
  process.stdout.write(JSON.stringify({ credentialPath: path, workspaceId: workspace.id }));
}

void provision().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

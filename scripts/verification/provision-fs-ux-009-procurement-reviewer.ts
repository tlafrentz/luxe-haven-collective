import { randomBytes, randomUUID } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
};
const url = required("NEXT_PUBLIC_SUPABASE_URL");
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("FSUX9_LOCAL_SUPABASE_REQUIRED");
const admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const output = required("FSUX9_REVIEWER_CREDENTIAL_FILE");
const workspaceId = required("FSUX9_WORKSPACE_ID");
async function main() {
  const suffix = randomUUID();
  const email = `fsux9-procurement-reviewer-${suffix}@example.invalid`;
  const password = `C8!${randomBytes(24).toString("base64url")}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "FS-UX-009 Procurement Reviewer",
      role: "admin",
    },
  });
  if (created.error || !created.data.user)
    throw created.error ?? new Error("FSUX9_REVIEWER_CREATE_FAILED");
  const id = created.data.user.id;
  for (const [operation, result] of [
    ["profile", await admin.from("profiles").upsert({
      id,
      email,
      full_name: "FS-UX-009 Procurement Reviewer",
      role: "admin",
    })],
    ["membership", await admin.from("workspace_memberships").upsert({
      workspace_id: workspaceId,
      profile_id: id,
      role: "administrator",
      status: "active",
      property_access_mode: "all",
      joined_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,profile_id" })],
  ] as const) {
    if (result.error)
      throw new Error(
        `FSUX9_REVIEWER_${operation.toUpperCase()}:${result.error.message}`,
      );
  }
  await writeFile(output, JSON.stringify({ admin: { email, password, id } }), {
    mode: 0o600,
  });
  await chmod(output, 0o600);
  process.stdout.write(JSON.stringify({ status: "created", id }));
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});

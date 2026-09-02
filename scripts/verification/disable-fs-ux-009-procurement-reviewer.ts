import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
};

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw new Error("FSUX9_LOCAL_SUPABASE_REQUIRED");
  const credentials = JSON.parse(
    await readFile(required("FSUX9_REVIEWER_CREDENTIAL_FILE"), "utf8"),
  ) as { admin: { id: string } };
  const admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await admin.auth.admin.updateUserById(credentials.admin.id, {
    ban_duration: "876000h",
    user_metadata: { controlled_fixture_status: "retained_disabled" },
  });
  if (result.error) throw result.error;
  process.stdout.write(JSON.stringify({ status: "disabled", id: credentials.admin.id }));
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});

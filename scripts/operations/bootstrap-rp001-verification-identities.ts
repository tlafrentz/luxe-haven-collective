import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createClient, type User } from "@supabase/supabase-js";

const confirmation = process.env.RP001_BOOTSTRAP_CONFIRM_PRODUCTION;
if (confirmation !== "I_CONFIRM_CONTROLLED_RP001_IDENTITY_BOOTSTRAP")
  throw new Error("Explicit production bootstrap confirmation is required.");

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const identities = Object.freeze([
  ["admin", "tlafrentz+rp001-admin@gmail.com", "RP-001 Verification Admin"],
  [
    "operator",
    "tlafrentz+rp001-operator@gmail.com",
    "RP-001 Verification Operator",
  ],
  ["owner", "tlafrentz+rp001-owner@gmail.com", "RP-001 Verification Owner"],
  [
    "wrong_tenant",
    "tlafrentz+rp001-wrong-tenant@gmail.com",
    "RP-001 Wrong Tenant Admin",
  ],
  [
    "different_owner",
    "tlafrentz+rp001-different-owner@gmail.com",
    "RP-001 Different Owner",
  ],
  ["no_access", "tlafrentz+rp001-no-access@gmail.com", "RP-001 No Access"],
  ["revoked", "tlafrentz+rp001-revoked@gmail.com", "RP-001 Revocation User"],
] as const);

async function ensureIdentity(email: string, fullName: string): Promise<User> {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  assert.equal(listError, null);
  const existing = listed.users.find((candidate) => candidate.email === email);
  if (existing) return existing;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: randomBytes(48).toString("base64url"),
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role:
        email.includes("rp001-owner") || email.includes("different-owner")
          ? "owner"
          : "guest",
      controlled_verification: "rp001",
    },
  });
  assert.equal(error, null);
  assert.ok(data.user);
  return data.user;
}

async function main() {
  const users = new Map<string, User>();
  for (const [roleClass, email, fullName] of identities)
    users.set(roleClass, await ensureIdentity(email, fullName));

  for (const [roleClass, email, fullName] of identities) {
    const user = users.get(roleClass)!;
    const { error } = await admin.from("profiles").upsert({
      id: user.id,
      email,
      full_name: fullName,
      role:
        roleClass === "owner" || roleClass === "different_owner"
          ? "owner"
          : "guest",
    });
    assert.equal(error, null);
  }

  const workspaceA = await ensureWorkspace(
    users.get("owner")!.id,
    "RP-001 Controlled Tenant A",
    "rp001-tenant-a@verification.invalid",
  );
  const workspaceB = await ensureWorkspace(
    users.get("different_owner")!.id,
    "RP-001 Controlled Tenant B",
    "rp001-tenant-b@verification.invalid",
  );
  const propertyA = await ensureProperty(
    workspaceA,
    "RP-001 Controlled Property A",
    "rp001-controlled-property-a",
    "101 Verification Way",
  );
  await ensureProperty(
    workspaceB,
    "RP-001 Controlled Property B",
    "rp001-controlled-property-b",
    "202 Verification Way",
  );

  await ensureMembership(workspaceA, users.get("owner")!.id, "owner", "all");
  await ensureMembership(
    workspaceA,
    users.get("admin")!.id,
    "administrator",
    "all",
  );
  await ensureMembership(
    workspaceA,
    users.get("operator")!.id,
    "operator",
    "selected",
    propertyA,
  );
  await ensureMembership(
    workspaceA,
    users.get("revoked")!.id,
    "viewer",
    "selected",
    propertyA,
  );
  await ensureMembership(
    workspaceB,
    users.get("different_owner")!.id,
    "owner",
    "all",
  );
  await ensureMembership(
    workspaceB,
    users.get("wrong_tenant")!.id,
    "administrator",
    "all",
  );

  process.stdout.write(
    JSON.stringify({
      status: "ready",
      schemaVersion: 1,
      identities: identities.map(([roleClass, email]) => ({
        roleClass,
        email,
      })),
      controlledWorkspaces: 2,
      controlledProperties: 2,
      noAccessMemberships: 0,
      revocationMembershipStatus: "active",
    }),
  );
}

async function ensureWorkspace(
  profileId: string,
  name: string,
  businessEmail: string,
) {
  const { data: existing, error: findError } = await admin
    .from("owners")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  assert.equal(findError, null);
  if (existing) return String(existing.id);
  const { data, error } = await admin
    .from("owners")
    .insert({
      profile_id: profileId,
      company_name: name,
      display_name: name,
      legal_name: name,
      business_email: businessEmail,
      timezone: "America/Chicago",
      currency: "USD",
      language: "en-US",
      country: "US",
    })
    .select("id")
    .single();
  assert.equal(error, null);
  return String(data.id);
}

async function ensureProperty(
  workspaceId: string,
  name: string,
  slug: string,
  address: string,
) {
  const { data, error } = await admin
    .from("properties")
    .upsert(
      {
        owner_id: workspaceId,
        name,
        slug,
        description:
          "Controlled synthetic RP-001 production verification property.",
        address_line_1: address,
        city: "Verification City",
        state: "TX",
        postal_code: "75001",
        country: "US",
        timezone: "America/Chicago",
        bedrooms: 2,
        bathrooms: 2,
        max_guests: 4,
        nightly_rate: 150,
        status: "active",
        source: "manual",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  assert.equal(error, null);
  return String(data.id);
}

async function ensureMembership(
  workspaceId: string,
  profileId: string,
  role: "owner" | "administrator" | "operator" | "viewer",
  propertyAccessMode: "all" | "selected",
  propertyId?: string,
) {
  const { data, error } = await admin
    .from("workspace_memberships")
    .upsert(
      {
        workspace_id: workspaceId,
        profile_id: profileId,
        role,
        status: "active",
        property_access_mode: propertyAccessMode,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,profile_id" },
    )
    .select("id")
    .single();
  assert.equal(error, null);
  if (propertyAccessMode === "selected") {
    assert.ok(propertyId);
    const { error: accessError } = await admin
      .from("workspace_member_property_access")
      .upsert({ membership_id: data.id, property_id: propertyId });
    assert.equal(accessError, null);
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

void main().catch((error: unknown) => {
  const classification =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "RP001_BOOTSTRAP_FAILED";
  process.stderr.write(
    JSON.stringify({
      status: "failed",
      classification,
    }),
  );
  process.exitCode = 1;
});

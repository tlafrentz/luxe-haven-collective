import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/20260725110000_workspace_team_access.sql", import.meta.url), "utf8");
const resolver = readFileSync(new URL("../../src/features/reservation-context/infrastructure/owner-identity.ts", import.meta.url), "utf8");
const booking = readFileSync(new URL("../../src/features/bookings/infrastructure/supabase-booking-read-repository.ts", import.meta.url), "utf8");
const operational = readFileSync(new URL("../../src/features/operational-surfaces/infrastructure/supabase-operational-surface-repository.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../../src/app/(dashboard)/dashboard/workspace/team/page.tsx", import.meta.url), "utf8");
const manager = readFileSync(new URL("../../src/features/workspace/presentation/team-access-manager.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../../src/app/actions/workspace-team-access.ts", import.meta.url), "utf8");
const acceptancePage = readFileSync(new URL("../../src/app/workspace-invitations/accept/page.tsx", import.meta.url), "utf8");

describe("Sprint 4C workspace team and access", () => {
  it("creates explicit membership, invitation, selected-property, activity, notification, and receipt persistence", () => {
    for (const table of ["workspace_memberships","workspace_invitations","workspace_member_property_access","workspace_access_activity","workspace_access_notifications","workspace_access_command_receipts"]) expect(migration).toContain(`public.${table}`);
    expect(migration).toContain("unique (workspace_id, profile_id)");
    expect(migration).toContain("workspace_invitations_one_pending_email_idx");
  });

  it("backfills owners idempotently without inventing invalid profiles", () => {
    expect(migration).toContain("join public.profiles p on p.id = o.profile_id");
    expect(migration).toContain("on conflict (workspace_id, profile_id) do update");
    expect(migration).toContain("Owner membership backfill left a valid owner without membership");
  });

  it("hashes tokens, expires and invalidates them, and prevents replay", () => {
    expect(migration).toContain("token_hash text not null");
    expect(migration).toContain("encode(digest(p_token,'sha256'),'hex')");
    expect(migration).toContain("invitation.expires_at<=now()");
    expect(migration).toContain("status='accepted'");
    expect(migration).toContain("token_hash=md5(random()::text)");
  });

  it("enforces membership and property scope through narrow non-recursive helpers and RLS", () => {
    expect(migration).toContain("public.active_workspace_role");
    expect(migration).toContain("public.can_access_workspace_property");
    expect(migration).toContain("membership.status = 'active'");
    expect(migration).toContain("Workspace members read authorized properties");
    expect(migration).toContain("Workspace members read authorized bookings");
    expect(migration).toContain("property_access_mode = 'selected'");
  });

  it("protects self access, administrators, other workspaces, and the final Owner server-side", () => {
    expect(migration).toContain("target_membership.profile_id = actor_id");
    expect(migration).toContain("Administrators cannot manage Owner access");
    expect(migration).toContain("where id=p_target_id and workspace_id=p_workspace_id");
    expect(migration).toContain("The final active Owner cannot be suspended or removed");
    expect(migration).toContain("The final active Owner cannot be demoted");
  });

  it("moves downstream property and booking reads through shared access context", () => {
    expect(resolver).toContain('.from("workspace_memberships")');
    expect(resolver).toContain("accessiblePropertyIds");
    expect(resolver).toContain("ownerProfileId");
    expect(booking).toContain("identity.accessiblePropertyIds");
    expect(operational).toContain("identity.accessiblePropertyIds");
    expect(operational).toContain("identity.ownerProfileId");
  });

  it("presents summary, first use, members, pending, role guidance, permission and activity states", () => {
    expect(page).toContain("Build your team");
    expect(page).toContain("Team access is managed by workspace owners and administrators");
    expect(page).toContain("Recent access activity");
    expect(manager).toContain("Pending invitations");
    expect(manager).toContain("Role guidance");
    expect(manager).toContain("Selected properties");
    expect(manager).toContain("window.confirm");
    expect(manager).toContain('aria-live="polite"');
  });

  it("routes authenticated invitees to acceptance before workspace membership exists", () => {
    expect(actions).toContain("/workspace-invitations/accept?workspace=");
    expect(actions).not.toContain("/dashboard/workspace/team/accept?workspace=");
    expect(acceptancePage).toContain("getSessionProfile");
    expect(acceptancePage).toContain("<AcceptWorkspaceInvitation");
    expect(acceptancePage).toContain("/login?next=");
  });
});

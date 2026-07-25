import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260724160000_workspace_foundation.sql", import.meta.url),
  "utf8",
);
const repository = readFileSync(
  new URL("../../src/features/workspace/infrastructure/supabase-workspace-repository.ts", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../../src/app/(dashboard)/dashboard/workspace/page.tsx", import.meta.url),
  "utf8",
);
const navigation = readFileSync(
  new URL("../../src/platform/experience/navigation/client-navigation.ts", import.meta.url),
  "utf8",
);

describe("Sprint 4A workspace foundation", () => {
  it("enforces one owner per profile and idempotent authenticated initialization", () => {
    expect(migration).toContain("owners_profile_id_unique");
    expect(migration).toContain("on conflict (profile_id)");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("profile.role in ('owner', 'admin')");
    expect(migration).toContain("grant execute on function public.initialize_workspace_owner()");
  });

  it("keeps profile, owner, and workspace identities explicit", () => {
    expect(repository).toContain("profileId");
    expect(repository).toContain("ownerId");
    expect(repository).toContain("workspaceId");
    expect(repository).toContain("workspaceId: data?.id ?? null");
    expect(repository).toContain("workspaceId: identity.profileId");
  });

  it("loads properties and health only through shared operational projections", () => {
    expect(repository).toContain("getOperationalSurfaceProjection");
    expect(repository).not.toContain('.from("properties")');
    expect(repository).not.toContain('.from("operational_sync_summaries")');
  });

  it("establishes the canonical route and presentation states", () => {
    expect(navigation).toContain('href: "/dashboard/workspace"');
    expect(page).toContain("Set up your workspace");
    expect(page).toContain("Workspace administration is restricted");
    expect(page).toContain("operational data is degraded");
    expect(page).toContain("Setup checklist");
  });
});

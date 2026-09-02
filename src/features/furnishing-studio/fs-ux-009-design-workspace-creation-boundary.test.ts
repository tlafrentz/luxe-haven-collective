import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830159000_fs_ux_009_design_workspace_creation_boundary.sql",
  "utf8",
);
const action = readFileSync(
  "src/app/actions/furnishing-project-workspace.ts",
  "utf8",
);

describe("FS-UX-009 Design Workspace creation boundary", () => {
  it("derives identity from auth.uid and preserves the catalog Admin boundary", () => {
    expect(migration).toContain("actor uuid:=auth.uid()");
    expect(migration).not.toContain("p_actor");
    expect(migration).not.toContain("is_admin()");
    expect(migration).not.toContain(
      "authorize_controlled_furnishing_catalog_mutation",
    );
    expect(action).toContain(
      'authenticated.rpc(\n      "create_authorized_furnishing_project_workspace"',
    );
    expect(action).not.toContain(
      "await assertFurnishingCatalogMutationAllowed(command.workspaceId)",
    );
  });

  it("requires active role, property access, controlled designation, and exact package lineage", () => {
    expect(migration).toContain(
      "public.active_workspace_role(destination_workspace)",
    );
    expect(migration).toContain(
      "('owner','administrator','operator','contributor')",
    );
    expect(migration).toContain("public.can_access_workspace_property(property_id)");
    expect(migration).toContain("furnishing_controlled_fixture_designations");
    expect(migration).toContain(
      "d.candidate_commit=context_row.candidate_commit",
    );
    expect(migration).toContain(
      "package_row.current_version_id is distinct from package_version.id",
    );
    expect(migration).toContain(
      "a.package_version_id=package_version.id",
    );
    expect(migration).toContain(
      "package_row.workspace_id<>destination_workspace",
    );
  });

  it("gives global and workspace suspension precedence and requires verified capability evidence", () => {
    expect(migration).toContain("FURNISHING_PROJECT_GLOBAL_SUSPENDED");
    expect(migration).toContain("FURNISHING_PROJECT_WORKSPACE_SUSPENDED");
    expect(migration).toContain("capability='design_workspace'");
    expect(migration).toContain("capability_row.verification_state<>'verified'");
    expect(migration).toContain("capability_row.verification_event_id is null");
    expect(migration).toContain("release_row.global_kill_switch");
  });

  it("serializes creation and rejects changed-input replay", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("request_fingerprint");
    expect(migration).toContain("command_context_id uuid not null unique");
    expect(migration).toContain("FURNISHING_PROJECT_IDEMPOTENCY_CONFLICT");
    expect(migration).toContain("'status','replayed'");
    expect(migration).toContain("insert into public.furnishing_projects");
    expect(migration).toContain(
      "insert into public.furnishing_project_creation_commands",
    );
  });

  it("keeps denial reasons explicit and grants no table mutation surface", () => {
    expect(action).toContain("/FURNISHING_PROJECT_[A-Z_]+/");
    expect(migration).toContain(
      "revoke all on public.furnishing_project_creation_commands from public,anon,authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.create_authorized_furnishing_project_workspace(jsonb)\n  to authenticated",
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete).*furnishing_project_creation_commands/i,
    );
  });
});

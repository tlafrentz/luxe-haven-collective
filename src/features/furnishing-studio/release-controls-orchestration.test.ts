import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260830151000_fs_ux_008_control_orchestration.sql",
  ),
  "utf8",
);
const anonymousCatalogCorrection = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260830153000_fs_ux_009_anonymous_catalog_verification.sql",
  ),
  "utf8",
);
const procurementGuardCorrection = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260830154000_fs_ux_009_procurement_guard_verification.sql",
  ),
  "utf8",
);
const actions = fs.readFileSync(
  path.join(root, "src/app/(admin)/admin/furnishing/activation/actions.ts"),
  "utf8",
);
const detail = fs.readFileSync(
  path.join(
    root,
    "src/app/(admin)/admin/furnishing/release-controls/workspaces/[workspaceId]/capabilities/[capability]/page.tsx",
  ),
  "utf8",
);
const controlAction = fs.readFileSync(
  path.join(
    root,
    "src/app/(admin)/admin/furnishing/release-controls/workspaces/[workspaceId]/control-action.tsx",
  ),
  "utf8",
);
const releaseControlPages = [
  "page.tsx",
  "history/page.tsx",
  "history/[eventId]/page.tsx",
  "workspaces/[workspaceId]/page.tsx",
  "workspaces/[workspaceId]/capabilities/[capability]/page.tsx",
].map((file) =>
  fs.readFileSync(
    path.join(root, "src/app/(admin)/admin/furnishing/release-controls", file),
    "utf8",
  ),
);

describe("FS-UX-008 governed orchestration contracts", () => {
  it("uses the admin shell as the single main landmark", () => {
    for (const page of releaseControlPages) expect(page).not.toContain("<main");
  });
  it("uses authoritative server verification without a client success assertion", () => {
    expect(actions).toContain("fsux8_verify_capability_v2");
    expect(actions).not.toContain("p_success");
    expect(migration).toContain("fsux8_capability_verification_checks");
    expect(migration).toContain(
      "FURNISHING_RELEASE_VERIFICATION_MUTATION_DETECTED",
    );
  });
  it("proves anonymous catalog denial through the anon-owned RLS boundary", () => {
    expect(anonymousCatalogCorrection).toContain(
      "owner to anon",
    );
    expect(anonymousCatalogCorrection).toContain(
      "row_security_active('public.furnishing_products'::regclass)",
    );
    expect(anonymousCatalogCorrection).toContain("unexpected_success");
    expect(anonymousCatalogCorrection).toContain("identity_unestablished");
    expect(anonymousCatalogCorrection).not.toContain("has_table_privilege");
  });
  it("verifies the authoritative procurement guard without toggling release state", () => {
    expect(procurementGuardCorrection).toContain(
      "fsux9_procurement_guard_invariant",
    );
    expect(procurementGuardCorrection).toContain(
      "assert_fs008g_procurement_mutation_enabled",
    );
    expect(procurementGuardCorrection).toContain(
      "deterministic_server_invariant",
    );
    expect(procurementGuardCorrection).not.toMatch(
      /update public\.furnishing_activation_releases/,
    );
    expect(procurementGuardCorrection).not.toContain("p_success");
  });
  it("preserves the other authoritative verification checks", () => {
    for (const check of [
      "anonymous_denial",
      "authorized_design_projection",
      "fixed_minor_unit_budget",
    ]) {
      expect(procurementGuardCorrection).toContain(check);
    }
  });
  it("serializes controls and gives suspension precedence", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("FURNISHING_RELEASE_GLOBAL_SUSPENDED");
    expect(migration).toContain("FURNISHING_RELEASE_WORKSPACE_SUSPENDED");
  });
  it("requires separate recovery authority and resolved risk", () => {
    expect(migration).toContain(
      "p_permission not in('workspace_recover','global_recover')",
    );
    expect(migration).toContain("FURNISHING_RELEASE_RISK_UNRESOLVED");
    expect(migration).toContain("capabilitiesRequireReverification");
  });
  it("exposes contextual rollback without paired controls", () => {
    expect(controlAction).toContain("Prepare rollback");
    expect(detail).toContain("rollbackBlocker");
    expect(detail).not.toContain(">Disable<");
  });
});

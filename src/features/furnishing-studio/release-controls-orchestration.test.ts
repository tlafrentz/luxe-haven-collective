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

describe("FS-UX-008 governed orchestration contracts", () => {
  it("uses authoritative server verification without a client success assertion", () => {
    expect(actions).toContain("fsux8_verify_capability_v2");
    expect(actions).not.toContain("p_success");
    expect(migration).toContain("fsux8_capability_verification_checks");
    expect(migration).toContain(
      "FURNISHING_RELEASE_VERIFICATION_MUTATION_DETECTED",
    );
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

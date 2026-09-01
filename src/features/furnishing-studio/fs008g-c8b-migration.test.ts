import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260829030000_fs008g_c8b_owner_selection_snapshot.sql",
  "utf8",
);
const projectActions = readFileSync(
  "src/app/actions/furnishing-project-workspace.ts",
  "utf8",
);
const snapshotAction = readFileSync(
  "src/app/actions/fs008d-governance.ts",
  "utf8",
);
const snapshotClient = readFileSync(
  "src/platform/commerce/application/fs008d-governance.ts",
  "utf8",
);

describe("FS-008G-C8-B owner selection migration", () => {
  it("discovers only exact-workspace approved governed packages for eligible FS-DESIGN owners", () => {
    expect(sql).toContain("discover_furnishing_owner_packages");
    expect(sql).toContain("fs008g_owner_selection_eligible");
    expect(sql).toContain("e.offer_code='FS-DESIGN'");
    expect(sql).toContain("e.offer_code in('FS-CONSULT','FS-FULL')");
    expect(sql).toContain("package_row.workspace_id=p_workspace_id");
    expect(sql).toContain("package_row.lifecycle_status='approved'");
    expect(projectActions).toContain(
      'authenticatedDb!.rpc("discover_furnishing_owner_packages"',
    );
    expect(projectActions).toContain(
      'throw new Error("FURNISHING_PROJECT_ACCESS_DENIED")',
    );
    expect(projectActions).toContain("FURNISHING_PACKAGE_ACCESS_DENIED");
  });

  it("governs save/resume, quantities, delivery, budget, stale revisions, and replay", () => {
    expect(sql).toContain("save_furnishing_selection_delivery");
    expect(sql).toContain("OWNER_SELECTION_FIXED_ONE");
    expect(sql).toContain("OWNER_SELECTION_QUANTITY_BOUNDS");
    expect(sql).toContain("OWNER_SELECTION_STALE_OR_INELIGIBLE");
    expect(sql).toContain("OWNER_SELECTION_REPLAY_CONFLICT");
    expect(sql).toContain("furnishing_selection_delivery_allocations");
    expect(sql).toContain("furnishing_owner_plan_commands");
    expect(sql).toContain("transition_furnishing_owner_plan");
    expect(sql).toContain("OWNER_PLAN_ADMIN_APPROVAL_REQUIRED");
    expect(sql).toContain("OWNER_PLAN_STALE");
    expect(sql).toContain("OWNER_PLAN_REPLAY_CONFLICT");
    expect(projectActions).toContain('await requireRole(["admin"])');
    expect(projectActions).toContain(
      'authenticated.rpc("transition_furnishing_owner_plan"',
    );
  });

  it("derives exactly one normalized immutable snapshot from the approved current plan", () => {
    expect(sql).toContain("fs008d_one_snapshot_per_approved_plan");
    expect(sql).toContain("SNAPSHOT_APPROVED_PLAN_REQUIRED");
    expect(sql).toContain("SNAPSHOT_SELECTION_NOT_NORMALIZED");
    expect(sql).toContain("SNAPSHOT_REPLAY_CONFLICT");
    expect(sql).toContain("FS008D_SNAPSHOT_IMMUTABLE");
    expect(sql).toContain("packageCompositionHash");
    expect(sql).toContain("selectionRevision");
  });

  it("does not accept client-authored package IDs, plan IDs, snapshots, hashes, or money", () => {
    const signature =
      "create_furnishing_project_catalog_snapshot(p_project_id uuid,p_correlation_id text,p_idempotency_key text)";
    expect(sql).toContain(signature);
    expect(sql).not.toMatch(
      /create_furnishing_project_catalog_snapshot\([^)]*p_snapshot/,
    );
    const snapshotWrapper = snapshotClient.slice(
      snapshotClient.indexOf(
        "export async function createFs008dProjectCatalogSnapshot",
      ),
    );
    expect(snapshotWrapper).not.toMatch(
      /snapshot:|contentHash:|packageVersionId:/,
    );
    const snapshotServerAction = snapshotAction.slice(
      snapshotAction.indexOf(
        "export async function createFs008dProjectSnapshot",
      ),
    );
    expect(snapshotServerAction).not.toMatch(
      /snapshot:|contentHash:|packageVersionId:/,
    );
  });

  it("returns a customer-safe projection and keeps audit lineage admin-only", () => {
    expect(sql).toContain("get_furnishing_owner_plan");
    expect(sql).toContain("jsonb_build_object('roomName'");
    expect(sql).toContain('create policy "Admins read owner plan audit"');
    expect(sql).toContain("OWNER_PROJECT_ACCESS_DENIED");
    const projection = sql.slice(
      sql.indexOf(
        "create or replace function public.get_furnishing_owner_plan",
      ),
      sql.indexOf(
        "alter table public.furnishing_selection_delivery_allocations",
      ),
    );
    expect(projection).not.toMatch(
      /correlation|idempotency|approved_by|reason|content_hash|credential/,
    );
  });
});

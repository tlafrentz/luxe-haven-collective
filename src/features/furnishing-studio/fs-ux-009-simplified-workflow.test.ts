import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830165000_fs_ux_009_simplified_workflow.sql",
  "utf8",
).toLowerCase();
const actions = readFileSync(
  "src/app/actions/furnishing-simple-workflow.ts",
  "utf8",
);

describe("FS-UX-009 simplified workflow", () => {
  it("uses approved snapshot items and procurement-line installation lineage", () => {
    expect(migration).toContain("approved_snapshot_id uuid not null");
    expect(migration).toContain("snapshot_item_id uuid not null unique");
    expect(migration).toContain("procurement_line_id uuid not null unique");
    expect(migration).not.toMatch(
      /furnishing_simple_(snapshot_items|procurement_lines|installation_lines)[\s\S]{0,300}fsux7_planned_lines/,
    );
  });

  it("keeps the customer state and checklist vocabularies bounded", () => {
    for (const value of [
      "approved",
      "procurement",
      "installation",
      "completed",
      "cancelled",
      "not_started",
      "ordered",
      "received",
      "issue",
      "partial",
      "installed",
    ])
      expect(migration).toContain(`'${value}'`);
  });

  it("uses authenticated clients for every user action", () => {
    expect(actions).toContain("await requireUser()");
    expect(actions).toContain("await createClient()");
    expect(actions).not.toContain("createAdminClient");
  });

  it("preserves stale, idempotency, completion, and external-effect guards", () => {
    expect(migration).toContain("furnishing_idempotency_conflict");
    expect(migration).toContain("furnishing_project_stale");
    expect(migration).toContain("furnishing_line_stale");
    expect(migration).toContain("furnishing_required_lines_unresolved");
    expect(migration.match(/'externaleffects',false/g)?.length).toBeGreaterThan(
      5,
    );
    expect(migration).not.toMatch(
      /insert into public\.(furnishing_procurement_orders|commerce_payments|notification_deliveries|provider_api_call_log)/,
    );
  });
});

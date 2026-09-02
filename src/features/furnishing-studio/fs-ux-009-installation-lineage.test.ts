import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830164000_fs_ux_009_installation_lineage_reconciliation.sql",
  "utf8",
).toLowerCase();

describe("FS-UX-009 installation lineage reconciliation", () => {
  it("supports exactly one snapshot-native or legacy selection lineage", () => {
    expect(migration).toContain(
      "alter column source_selection_id drop not null",
    );
    expect(migration).toContain(
      "add column source_snapshot_item_id uuid references public.fs008d_snapshot_items(id)",
    );
    expect(migration).toContain("fsux7_planned_line_source_exactly_one");
    expect(migration).toContain(
      "source_selection_id is not null and source_snapshot_item_id is null",
    );
    expect(migration).toContain(
      "source_selection_id is null and source_snapshot_item_id is not null",
    );
  });

  it("materializes lineage from the procurement line's authoritative source kind", () => {
    expect(migration).toContain(
      "case when line.source_line_kind='plan_selection' then line.source_plan_line_id end",
    );
    expect(migration).toContain(
      "case when line.source_line_kind='snapshot_item' then line.source_snapshot_item_id end",
    );
    expect(migration).toContain(
      "snapshot_item.snapshot_id=baseline.source_catalog_snapshot_id",
    );
    expect(migration).toContain("snapshot_item.project_id=baseline.project_id");
    expect(migration).toContain(
      "selection_plan.project_id=baseline.project_id",
    );
    expect(migration).toContain("installation_source_lineage_invalid");
  });

  it("revalidates the approved current readiness snapshot under lock", () => {
    expect(migration).toContain(
      "baseline.current_readiness_version_id is distinct from readiness.readiness_version_id",
    );
    expect(migration).toContain("value.state='approved'");
    expect(migration).toContain("for update");
    expect(migration).toContain(
      "perform public.fsux6_assert_actor(baseline.workspace_id,false)",
    );
  });

  it("scopes shipment, allocation, inspection, and completion evidence to one installation", () => {
    expect(migration).toContain(
      "o.installation_project_id=i and o.baseline_id=p.procurement_baseline_id",
    );
    expect(migration).toContain(
      "receipt.installation_project_id=i and planned.id=pl",
    );
    expect(migration).toContain(
      "value.id=pl and value.installation_project_id=i",
    );
    expect(migration).toContain(
      "receipt.installation_project_id=i and receipt.archived_at is null",
    );
  });

  it("preserves no-external-effect creation and completion results", () => {
    expect(
      migration.match(/'external_effects',false/g)?.length,
    ).toBeGreaterThanOrEqual(3);
    expect(migration).not.toMatch(
      /insert into public\.(commerce_payments|notification_deliveries)/,
    );
  });

  it("grants only the embedded installation-source projection columns", () => {
    expect(migration).toContain(
      "grant select(id,workspace_id,readiness_status,current_readiness_version_id,archived_at)",
    );
    expect(migration).toContain(
      "grant select(id,workspace_id,procurement_baseline_id,tracking_status,archived_at)",
    );
    expect(migration).not.toMatch(
      /grant (insert|update|delete).*furnishing_(procurement_baselines|installation_projects).*authenticated/,
    );
  });

  it("allows trusted server rendering to read every installation evidence projection", () => {
    for (const table of [
      "fsux7_planned_lines",
      "fsux7_order_evidence",
      "fsux7_delivery_events",
      "fsux7_room_allocations",
      "fsux7_installation_events",
      "fsux7_tracking_exceptions",
      "fsux7_inspections",
      "fsux7_completion_snapshots",
    ])
      expect(migration).toContain(table);
    expect(migration).toContain("to service_role");
  });
});

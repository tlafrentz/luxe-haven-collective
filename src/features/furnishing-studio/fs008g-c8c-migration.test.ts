import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260829040000_fs008g_c8c_procurement_cleanup.sql",
  "utf8",
);
const actions = readFileSync(
  "src/app/actions/furnishing-procurement.ts",
  "utf8",
);
const browser = readFileSync(
  "scripts/verification/verify-fs008g-c8-browser.ts",
  "utf8",
);
const runbook = JSON.parse(
  readFileSync("docs/runbooks/fs008g-finalization.json", "utf8"),
);

describe("FS-008G-C8-C procurement and certification boundaries", () => {
  it("creates baselines only from the authoritative normalized snapshot", () => {
    expect(sql).toContain("PROCUREMENT_SNAPSHOT_SOURCE_REQUIRED");
    expect(sql).toContain("PROCUREMENT_AUTHORITATIVE_SNAPSHOT_REQUIRED");
    expect(sql).toContain("PROCUREMENT_SNAPSHOT_NOT_NORMALIZED");
    expect(sql).toContain("PROCUREMENT_BASELINE_REPLAY_CONFLICT");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(actions).toContain('source_kind: "catalog_snapshot"');
    expect(actions).not.toContain('source_kind: "furnishing_plan"');
  });

  it("governs discrepancy history, adjustments, kill switch and cleanup", () => {
    for (const token of [
      "furnishing_procurement_discrepancy_history",
      "DISCREPANCY_REPLAY_CONFLICT",
      "adjust_furnishing_procurement_budget",
      "PROCUREMENT_ADJUSTMENT_REPLAY_CONFLICT",
      "assert_fs008g_procurement_mutation_enabled",
      "cleanup_fs008g_synthetic_project",
      "CLEANUP_RECONCILIATION_FAILED",
      "retainedAuditEvents",
      "retainedCatalogResources",
    ])
      expect(sql).toContain(token);
  });

  it("exposes a narrow owner read model while all mutations remain admin-only", () => {
    expect(sql).toContain("get_furnishing_customer_procurement");
    expect(sql).toContain("PROCUREMENT_CUSTOMER_ACCESS_DENIED");
    expect(
      sql.match(/PROCUREMENT_ADMIN_REQUIRED/g)?.length,
    ).toBeGreaterThanOrEqual(4);
    const projection = sql.slice(
      sql.indexOf(
        "create or replace function public.get_furnishing_customer_procurement",
      ),
      sql.indexOf(
        "create or replace function public.prevent_fs008d_snapshot_mutation",
      ),
    );
    expect(projection).not.toMatch(
      /reason|correlation|idempotency|externalOrder|sourceHash|actorId|credential/,
    );
  });

  it("provides an executable isolated browser lifecycle bound to the runbook", () => {
    expect(browser).toContain("chromium.launch({ headless: true })");
    expect(browser).toContain("FS008G_BROWSER_ISOLATED_ORIGIN_REQUIRED");
    expect(browser).toContain("page.reload");
    expect(browser).toContain("CUSTOMER_PROJECTION_LEAK");
    expect(Object.values(runbook.externalEffects)).not.toContain(true);
    expect(runbook.steps).toHaveLength(13);
  });
});

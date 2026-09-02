import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830161000_fs_ux_009_remaining_path_integration_fixes.sql",
  "utf8",
);
const procurementActions = readFileSync(
  "src/app/(admin)/admin/furnishing/procurement/actions.ts",
  "utf8",
);
const installationActions = readFileSync(
  "src/app/(admin)/admin/furnishing/installations/actions.ts",
  "utf8",
);
const procurementUi = readFileSync(
  "src/components/furnishing/procurement-readiness-v2.tsx",
  "utf8",
);
const installationUi = readFileSync(
  "src/components/furnishing/delivery-installation-v2.tsx",
  "utf8",
);

describe("FS-UX-009 remaining path integration fixes", () => {
  it("targets the canonical allocation constraint without rewriting history", () => {
    expect(migration).toContain(
      "on conflict on constraint furnishing_selection_delivery_allo_selection_id_property_id_key",
    );
    expect(migration).not.toContain("on conflict(selection_id,property_id)");
    expect(migration).toContain("furnishing_owner_plan_commands");
  });

  it("binds receipt and installation sources to the authoritative tracking project", () => {
    expect(migration).toContain("o.installation_project_id=i");
    expect(migration).toContain("o.baseline_id=p.procurement_baseline_id");
    expect(migration).toContain("receipt.installation_project_id=i");
    expect(migration).toContain("INSTALLATION_SOURCE_INVALID");
    expect(migration).toContain("RECEIPT_SOURCE_INVALID");
  });

  it("uses authenticated RPC actions for the required remaining workflow", () => {
    expect(procurementActions).toContain('rpc("fsux6_update_delivery_plan"');
    expect(installationActions).toContain('rpc("fsux7_record_inspection"');
    expect(procurementUi).toContain("Save delivery plan");
    expect(installationUi).toContain("Record property inspection");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "../../../supabase/migrations/20260806056000_fs001_canonical_furnishing_schema.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();

describe("FS-001 migration", () => {
  it("separates catalog, offers, package requirements, selections, and procurement", () => {
    for (const table of [
      "furnishing_products",
      "furnishing_product_offers",
      "furnishing_room_package_items",
      "furnishing_product_selections",
      "furnishing_procurement_items",
      "furnishing_receiving_records",
    ])
      expect(sql).toContain(`create table public.${table}`);
    expect(sql).not.toContain("furniture_items");
  });
  it("uses canonical properties and workspace scope", () => {
    expect(sql).toContain(
      "property_id uuid not null unique references public.properties(id)",
    );
    expect(sql).toContain("workspace_id uuid references public.owners(id)");
    expect(sql).toContain("active_workspace_role");
  });
  it("stores money in minor units and versions packages and plans", () => {
    expect(sql).toContain("amount_minor");
    expect(sql).toContain("furnishing_room_package_versions");
    expect(sql).toContain("furnishing_package_versions");
    expect(sql).toContain("unique(project_id,version_number)");
  });
});

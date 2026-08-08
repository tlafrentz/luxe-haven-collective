import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "../../../supabase/migrations/20260806057000_fs002_product_catalog.sql",
    import.meta.url,
  ),
  "utf8",
).toLowerCase();
describe("FS-002 migration", () => {
  it("operationalizes catalog classification and offers without project purchases", () => {
    for (const table of [
      "furnishing_product_categories",
      "furnishing_product_room_compatibility",
      "furnishing_product_media",
      "furnishing_catalog_imports",
      "furnishing_catalog_import_items",
    ])
      expect(sql).toContain(`create table public.${table}`);
    expect(sql).not.toContain("project purchase");
  });
  it("stores price and pack semantics canonically", () => {
    expect(sql).toContain("preferred_offer_id");
    expect(sql).toContain("units_per_purchase integer");
    expect(sql).toContain("proposed_price_minor bigint");
  });
  it("seeds taxonomy, rooms, and retailers as records rather than enums", () => {
    expect(sql).toContain("insert into public.furnishing_product_categories");
    expect(sql).toContain("insert into public.furnishing_room_types");
    expect(sql).toContain("insert into public.furnishing_retailers");
  });
});

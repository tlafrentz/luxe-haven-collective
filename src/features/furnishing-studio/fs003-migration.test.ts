import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(
  "supabase/migrations/20260806058000_fs003_room_package_library.sql",
  "utf8",
);
describe("FS-003 migration", () => {
  it("creates stable requirements and product alternatives", () => {
    expect(sql).toContain("furnishing_room_requirements");
    expect(sql).toContain("furnishing_package_product_alternatives");
  });
  it("keeps package imports reviewed and formulas as raw source only", () => {
    expect(sql).toContain("furnishing_package_import_items");
    expect(sql).toContain("requires_review");
    expect(sql).not.toContain("eval(");
  });
  it("enables RLS on every new aggregate", () => {
    expect(sql.match(/enable row level security/g)?.length).toBe(4);
  });
});

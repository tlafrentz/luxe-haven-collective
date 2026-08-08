import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(
  "supabase/migrations/20260806059000_fs004_design_style_system.sql",
  "utf8",
);
describe("FS-004 migration", () => {
  it("versions reusable styles and property profiles", () => {
    expect(sql).toContain("furnishing_style_system_versions");
    expect(sql).toContain("furnishing_design_profile_versions");
  });
  it("keeps explainable compatibility and exceptions explicit", () => {
    expect(sql).toContain("furnishing_product_style_assignments");
    expect(sql).toContain("furnishing_design_exceptions");
    expect(sql).toContain("provenance");
  });
  it("supports structured tokens and mood boards", () => {
    expect(sql).toContain("furnishing_design_tokens");
    expect(sql).toContain("furnishing_mood_board_items");
  });
  it("enables tenant controls on all new tables", () =>
    expect(sql.match(/enable row level security/g)?.length).toBe(10));
});

import { describe, expect, it } from "vitest";
import { assertFurnishingActivationMutationDisabled } from "@/features/furnishing-studio/activation";

describe("FS-008A P2.3A catalog application guards", () => {
  it("fails closed with the stable safe-state denial", () => {
    expect(() => assertFurnishingActivationMutationDisabled()).toThrow("FURNISHING_ACTIVATION_DISABLED");
  });
  it("keeps the database trigger as defense in depth", async () => {
    const sql = await import("fs/promises").then((fs) => fs.readFile("supabase/migrations/20260825010000_fs008a_activation_controls.sql", "utf8"));
    expect(sql).toContain("commercial_catalog_publications");
    expect(sql).toContain("fs008a_deny_furnishing_effect");
  });
});

import { describe, expect, it } from "vitest";
import { assertFurnishingActivationMutationDisabled } from "@/features/furnishing-studio/activation";

describe("FS-008A P2.3B installation and customer-effect guards", () => {
  it("denies every write scope before database, storage, provider, or notification effects", () => {
    expect(() => assertFurnishingActivationMutationDisabled()).toThrow("FURNISHING_ACTIVATION_DISABLED");
  });
  it("retains the database installation defense-in-depth trigger", async () => {
    const sql = await import("fs/promises").then((fs) => fs.readFile("supabase/migrations/20260825010000_fs008a_activation_controls.sql", "utf8"));
    expect(sql).toContain("furnishing_installation_projects");
    expect(sql).toContain("fs008a_deny_furnishing_effect");
  });
});

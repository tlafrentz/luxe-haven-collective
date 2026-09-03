import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";

describe("FS-UX-010 Product Library migration guards", () => {
  it("defines the governed create/archive RPCs with admin gating", async () => {
    const sql = await fs.readFile(
      "supabase/migrations/20260902020000_fs_ux_010_product_library.sql",
      "utf8",
    );
    expect(sql).toContain("create_furnishing_library_product");
    expect(sql).toContain("archive_furnishing_library_product");
    expect(sql).toContain("FURNISHING_CATALOG_ADMIN_REQUIRED");
    // The new create/archive RPCs deliberately do not call the FS-008A
    // blanket kill-switch guard, following the precedent already set by
    // every other FS-UX-002 governed RPC (adopt/edit/approve/transition).
    expect(sql).not.toContain("assertFurnishingActivationMutationDisabled");
  });

  it("generalizes duplicate identity to canonical_url and platform scope", async () => {
    const sql = await fs.readFile(
      "supabase/migrations/20260902020000_fs_ux_010_product_library.sql",
      "utf8",
    );
    expect(sql).toContain("canonical_url");
    expect(sql).toContain("CATALOG_CANONICAL_URL_ALREADY_CLAIMED");
    expect(sql).toContain("claim_furnishing_product_identity");
    expect(sql).toContain("furnishing_product_identity_claims_platform_uq");
  });

  it("does not call the FS-008A kill switch from the app-layer library actions", async () => {
    const source = await fs.readFile("src/app/actions/furnishing-library.ts", "utf8");
    expect(source).not.toContain("assertFurnishingActivationMutationDisabled");
  });
});

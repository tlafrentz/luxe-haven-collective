import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync(
  "src/app/actions/furnishing-catalog-activation.ts",
  "utf8",
);
const catalog = readFileSync("src/app/actions/furnishing-catalog.ts", "utf8");
const view = readFileSync(
  "src/components/furnishing/product-catalog-workspace.tsx",
  "utf8",
);

describe("FS-008G controlled catalog mutation boundary", () => {
  it("requires the exact controlled workspace at the Admin import surface", () => {
    expect(view).toContain("Controlled workspace ID");
    expect(view).toContain('name="workspaceId"');
    expect(view).toContain("Canonical controlled workspace UUID");
    expect(catalog).toContain('text(formData, "workspaceId")');
    expect(catalog).toContain("workspace_id: workspaceId");
  });

  it("revalidates every activation layer through ordinary authenticated reads", () => {
    expect(access).toContain("createClient()");
    expect(access).toContain('eq("workspace_id", workspaceId)');
    expect(access).toContain('eq("capability", "catalog_viewing")');
    for (const guard of [
      "global_kill_switch",
      "global_state",
      "configuration_valid",
      "kill_switch",
      'cohort === "internal"',
      "revoked_at",
      "expires_at",
      "capability?.enabled",
    ])
      expect(access).toContain(guard);
    expect(access).not.toContain("createAdminClient");
  });

  it("binds parse and reviewed import to the same workspace and fails closed", () => {
    expect(catalog).toMatch(
      /startCatalogImportAction[\s\S]+assertFurnishingCatalogMutationAllowed\(workspaceId\)/,
    );
    expect(catalog).toMatch(
      /completeCatalogImportAction[\s\S]+select\("workspace_id,status"\)[\s\S]+assertFurnishingCatalogMutationAllowed/,
    );
    expect(catalog).toContain('importTarget.status !== "review_required"');
    expect(access).toContain('throw new Error("FURNISHING_ACTIVATION_DISABLED")');
  });
});

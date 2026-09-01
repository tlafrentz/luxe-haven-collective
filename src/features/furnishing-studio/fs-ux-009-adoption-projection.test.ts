import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830157000_fs_ux_009_adoption_projection_service_read.sql",
  "utf8",
).toLowerCase();
const productDetail = readFileSync(
  "src/components/furnishing/product-catalog-workspace.tsx",
  "utf8",
);

describe("FS-UX-009 adoption projection service boundary", () => {
  it("grants service_role only the three projection columns", () => {
    expect(migration).toContain(
      "revoke all on table public.furnishing_product_adoptions from service_role",
    );
    expect(migration).toMatch(
      /grant select\s*\(workspace_id,\s*source_product_id,\s*workspace_product_id\)/,
    );
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)/);
    expect(migration).not.toMatch(/\bto\s+(anon|authenticated)\b/);
    expect(migration).not.toMatch(/create\s+policy|alter\s+policy|drop\s+policy/);
  });

  it("keeps the server projection scoped to workspace and source product", () => {
    expect(productDetail).toContain(
      '.from("furnishing_product_adoptions").select("workspace_product_id")',
    );
    expect(productDetail).toContain('.eq("workspace_id", controlledWorkspace)');
    expect(productDetail).toContain('.eq("source_product_id", product.id)');
  });
});

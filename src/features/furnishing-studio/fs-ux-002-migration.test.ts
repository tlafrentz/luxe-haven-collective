import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("supabase/migrations/20260830090000_fs_ux_002_catalog_lifecycle.sql", "utf8");
describe("FS-UX-002 governed catalog lifecycle", () => {
  it("adopts rather than mutating platform products", () => { expect(sql).toContain("adopt_furnishing_platform_product"); expect(sql).toContain("scope='platform' and workspace_id is null"); expect(sql).toContain("'draft','workspace'"); expect(sql).not.toMatch(/update public\.furnishing_products set scope='workspace'/); });
  it("persists immutable adoption lineage and idempotency", () => { for (const value of ["source_product_id","workspace_product_id","source_revision","source_digest","adopted_fields","workspace_overrides","idempotency_key","correlation_id"]) expect(sql).toContain(value); expect(sql).toContain("unique(workspace_id,source_product_id)"); });
  it("fails closed across workspace and activation boundaries", () => { expect(sql).toContain("authorize_controlled_furnishing_catalog_mutation(workspace)"); expect(sql).toContain("FURNISHING_CATALOG_ADMIN_REQUIRED"); expect(sql).toContain("CATALOG_ADOPTION_REPLAY_CONFLICT"); });
  it("keeps direct platform approval invalid", () => { expect(sql).toContain("p.workspace_id=workspace and p.scope='workspace'"); expect(sql).toContain("CATALOG_APPROVAL_TARGET_SCOPE_INVALID"); });
  it("governs review, concurrency and retirement without deletion", () => { expect(sql).toContain("transition_furnishing_product_review"); expect(sql).toContain("CATALOG_PRODUCT_VERSION_STALE"); expect(sql).toContain("retirement_reason"); expect(sql).not.toMatch(/delete from public\.furnishing_products/); });
  it("updates drafts but proposes approved revisions without rewriting live history", () => { expect(sql).toContain("edit_furnishing_product"); expect(sql).toContain("product.status='draft'"); expect(sql).toContain("'catalog_product_update_proposed'"); expect(sql).toContain("CATALOG_REVISION_ALREADY_OPEN"); expect(sql).toContain("furnishing_product_versions"); });
  it("approves a proposed version with optimistic concurrency", () => { expect(sql).toContain("approve_furnishing_product_revision"); expect(sql).toContain("base_version=expected"); expect(sql).toContain("lifecycle_status='superseded'"); expect(sql).toContain("revision=proposal.version"); });
  it("uses one canonical identity boundary for manual creation, adoption, offers, and revision approval", () => {
    expect(sql).toContain("canonical_furnishing_product_identity");
    expect(sql).toContain("claim_furnishing_workspace_product_identity");
    expect(sql).toContain("furnishing_workspace_product_identity_enforced");
    expect(sql).toContain("enforce_furnishing_workspace_offer_identity");
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended('furnishing-product-identity:'");
    expect(sql).toContain("perform public.claim_furnishing_workspace_product_identity(product.id,product.family_product_id,proposal.product_snapshot)");
  });
  it("does not let null commercial fields or retirement bypass workspace identity enforcement", () => {
    expect(sql).toContain("coalesce(p_retailer_id::text,'<null>')");
    expect(sql).toContain("coalesce(p_sku,'')");
    expect(sql).toContain("CATALOG_RETIRED_IDENTITY_REQUIRES_REPLACEMENT");
    expect(sql).toContain("retired_at=coalesce(retired_at,now())");
    expect(sql).toContain("unique(workspace_id,identity_kind,identity_key)");
  });
  it("does not introduce external effects or activation changes", () => { expect(sql).toContain("'externalEffects',false"); expect(sql).not.toMatch(/update public\.furnishing_activation_/); expect(sql).not.toMatch(/insert into public\.(?:furnishing_procurement_orders|notification_deliveries|payment)/); });
});

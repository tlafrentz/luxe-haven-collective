import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260829050000_fs008g_c8d_workspace_native_import.sql",
  "utf8",
);
const action = readFileSync("src/app/actions/furnishing-catalog.ts", "utf8");

describe("FS-008G-C8-D platform-library import", () => {
  it("creates platform drafts and leaves workspace transition to adoption", () => {
    expect(sql).toContain("values('platform',null");
    expect(sql).toContain("values(null,product_id");
    expect(sql).toContain("'scope','platform'");
    expect(sql).not.toMatch(/p_input->>'scope'/);
    expect(action).not.toMatch(/formData\.get\(["'](?:scope|workspaceId)["']\)/);
  });

  it("preserves platform rows and rejects workspace match targets", () => {
    expect(sql).not.toMatch(/update public\.furnishing_products set scope/);
    expect(sql).toContain("p.scope='platform' and p.workspace_id is null");
    expect(sql).toContain("FS008G_C8D_MATCH_SCOPE_INVALID");
    expect(sql).toContain("p.scope='platform' and p.workspace_id is null");
  });

  it("keeps the 110-row transaction atomic with one governed skip", () => {
    expect(sql).toContain("run.total_rows<>110");
    expect(sql).toContain("for item in select");
    expect(sql).toContain("item.review_action in('review','skip')");
    expect(sql).toContain("v_skipped:=v_skipped+1");
    expect(sql).toContain("FS008G_C7_REPLAY_CONFLICT");
    expect(sql).toContain("OFFER_TARGET_INVALID");
    expect(sql).not.toContain("exception when others then null");
  });

  it("records no downstream or external effects", () => {
    expect(sql).toContain("'externalEffects',false");
    expect(sql).not.toMatch(
      /insert into public\.(?:notification_deliveries|furnishing_projects|fs008d_project_catalog_snapshots|furnishing_procurement_|furnishing_installation_)/,
    );
  });
});

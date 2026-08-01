import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(
  "supabase/migrations/20260731090000_gb001_guidebook_studio_v1.sql",
  "utf8",
);
describe("GB-001C media persistence contract", () => {
  it("persists draft and immutable version references", () => {
    expect(sql).toContain(
      "create table if not exists public.guidebook_draft_media",
    );
    expect(sql).toContain(
      "create table if not exists public.guidebook_version_media",
    );
    expect(sql).toContain("on delete restrict");
    expect(sql).toContain("insert into public.guidebook_version_media");
  });
  it("keeps authoring private and anonymous delivery narrow", () => {
    expect(sql).toMatch(
      /guidebook-authoring-media','guidebook-authoring-media',false/,
    );
    expect(sql).toMatch(
      /guidebook-public-media','guidebook-public-media',true/,
    );
    expect(sql).toContain("Public reads immutable guidebook media");
    expect(sql).toContain(
      "revoke all on public.guidebook_media_assets,public.guidebook_version_media from anon",
    );
  });
  it("rotates normalized slugs through scoped receipts and expiring redirects", () => {
    expect(sql).toContain("rotate_guidebook_public_slug");
    expect(sql).toContain("command_receipt_conflict");
    expect(sql).toContain("p_expires_at<=now()");
    expect(sql).toContain("guidebook_public_slug_redirects");
  });
  it("selects one owner-scoped bounded library page", () => {
    expect(sql).toContain("list_guidebook_library_page");
    expect(sql).toContain("public.can_access_workspace_property(property.id)");
    expect(sql).toContain("limit least(50,greatest(1,p_limit))");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260727000000_guidebook_version_history.sql",
  ),
  "utf8",
);

describe("guidebook history migration", () => {
  it("preserves version provenance and append-only restoration history", () => {
    expect(sql).toContain("artifact_version");
    expect(sql).toContain("renderer_version");
    expect(sql).toContain("validation_outcome");
    expect(sql).toContain("guidebook_restore_history_immutable");
    expect(sql).toContain("version-restored-to-draft");
  });

  it("restores snapshots into drafts without mutating historical versions", () => {
    expect(sql).toContain("restore_guidebook_version_to_draft");
    expect(sql).toContain("source_version_id");
    expect(sql).not.toMatch(/update public\.guidebook_versions[\s\S]*restore_guidebook_version_to_draft/);
  });

  it("records exact guest delivery lineage", () => {
    expect(sql).toContain("guidebook_guest_deliveries");
    expect(sql).toContain("guidebook_version_id");
    expect(sql).toContain("reservation_id");
    expect(sql).toContain("guest_id");
    expect(sql).toContain("delivery_reference_hash");
  });
});

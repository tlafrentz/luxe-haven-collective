import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260805010000_guidebook_canonical_libraries_v1.sql",
  "utf8",
);

describe("guidebook canonical libraries migration", () => {
  it("creates versioned canonical artifacts, usage lineage, governed media, and RLS", () => {
    for (const table of [
      "guidebook_library_artifacts",
      "guidebook_library_versions",
      "guidebook_library_usage",
      "guidebook_media_collections",
      "guidebook_library_media_files",
    ])
      expect(sql).toContain(`create table if not exists public.${table}`);
    expect(sql).toContain("protect_published_guidebook_library_version");
    expect(
      sql.match(/enable row level security/g)?.length,
    ).toBeGreaterThanOrEqual(5);
    expect(sql).toContain("guidebook-library-media");
  });
  it("seeds the required libraries idempotently without moving furnishing ownership", () => {
    for (const value of [
      "Welcome Home",
      "Wi-Fi Card",
      "Luxury Coastal",
      "Minimal Essentials",
      "Brand Assets",
      "Modern Apartment",
      "Throw Blanket",
      "Workspace",
    ])
      expect(sql).toContain(value);
    expect(sql).toContain("on conflict");
    expect(sql).toContain("public.furnishing_package_items");
    expect(sql).not.toContain("guidebook_furnishing_packages");
  });
});

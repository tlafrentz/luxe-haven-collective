import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read(
  "supabase/migrations/20260731090000_gb001_guidebook_studio_v1.sql",
);
const domain = read("src/features/guidebook-studio/domain/guidebook.ts");
const deliveryRepository = read(
  "src/features/guidebook-studio/infrastructure/supabase-guest-delivery-repository.ts",
);
const publicPage = read("src/app/(public)/g/[publicSlug]/page.tsx");

describe("GB-001 Guidebook Studio v1 architecture", () => {
  it("limits new content to the nine canonical v1 block types", () => {
    for (const type of [
      "heading",
      "rich-text",
      "image",
      "instruction",
      "contact",
      "location",
      "link",
      "callout",
      "checklist",
    ]) {
      expect(domain).toContain(`"${type}"`);
      expect(migration).toContain(`'${type}'`);
    }
    for (const postV1 of ["gallery", "video", "button", "divider"]) {
      expect(domain).not.toContain(`"${postV1}"`);
    }
  });

  it("seeds exactly the approved v1 guest-information sections", () => {
    for (const key of [
      "welcome",
      "arrival",
      "parking",
      "property-access",
      "wi-fi",
      "house-rules",
      "amenities",
      "local-recommendations",
      "checkout",
      "safety",
      "contact",
    ]) {
      expect(domain).toContain(`"${key}"`);
    }
    expect(migration).toContain("create_guidebook_with_receipt");
    expect(migration).toContain("('welcome','Welcome',0)");
  });

  it("uses immutable active snapshots for anonymous rendering", () => {
    expect(deliveryRepository).toContain("active_version_id");
    expect(deliveryRepository.replace(/\s+/g, "")).toContain(
      '.eq("status","published")',
    );
    expect(publicPage).toContain("ArtifactRenderingEngine");
    expect(publicPage).not.toContain("properties");
    expect(publicPage).not.toContain("guidebook_sections");
  });

  it("hardens property-scoped RLS and leaves anonymous tables closed", () => {
    expect(migration).toContain("public.active_workspace_role(workspace_id)");
    expect(migration).toContain(
      "public.can_access_workspace_property(property_id)",
    );
    expect(migration).toContain("revoke all on public.guidebooks");
    expect(migration).toContain("from anon");
  });

  it("provides durable command and publication idempotency boundaries", () => {
    expect(migration).toContain("guidebook_command_receipts");
    expect(migration).toContain("primary key (workspace_id, command_id)");
    expect(migration).toContain("guidebook_publication_idempotency_idx");
  });
});

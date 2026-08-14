import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Guidebook Studio canonical Builder reconciliation", () => {
  it("loads Admin and Dashboard edit routes through the same server loader", () => {
    for (const path of [
      "src/app/(admin)/admin/guidebooks/[guidebookId]/edit/page.tsx",
      "src/app/(dashboard)/dashboard/guidebooks/[guidebookId]/edit/page.tsx",
    ]) {
      const route = source(path);
      expect(route).toContain("CanonicalGuidebookBuilderPage");
      expect(route).not.toContain("GuidebookAuthoringWorkspace");
    }
  });

  it("redirects every legacy writable entry to the canonical edit route", () => {
    for (const path of [
      "src/app/(admin)/admin/guidebooks/[guidebookId]/page.tsx",
      "src/app/(admin)/admin/guidebooks/[guidebookId]/compose/page.tsx",
      "src/app/(admin)/admin/guidebooks/[guidebookId]/versions/[versionId]/edit/page.tsx",
      "src/app/(dashboard)/dashboard/guidebooks/[guidebookId]/page.tsx",
      "src/app/(dashboard)/dashboard/guidebooks/[guidebookId]/compose/page.tsx",
    ]) {
      const route = source(path);
      expect(route).toContain("/edit");
      expect(route).not.toContain("GuidebookAuthoringWorkspace");
    }
  });

  it("uses the authenticated public renderer preview and accurate save states", () => {
    const builder = source(
      "src/components/guidebooks/guidebook-builder-workspace.tsx",
    );
    expect(builder).toContain("preview?mode=draft&viewport=${viewport}&embed=1");
    expect(builder).toContain('unsaved: "Unsaved changes"');
    expect(builder).toContain('failed: "Save failed — Retry"');
    expect(builder).toContain('conflict: "Conflict detected — Review changes"');
    expect(builder).toContain("guidebook-preview:block-selected");
    expect(builder).toContain("guidebook-preview:hero-selected");
    expect(builder).toContain("Edit hero");
    expect(builder).toContain('type: "update-details"');
    expect(builder).toContain("onUpdateRef.current(pending.description, pending.headline)");
    expect(builder).toContain("onBlur={() => void commit()}");
    expect(builder).toContain("Save hero");
    expect(builder).toContain("Hero saved to the draft.");
    expect(builder).toContain('window.location.hash !== "#add-photos"');
    expect(builder).toContain("choose an approved Image or Gallery component");
    expect(builder).not.toContain('{ type: "image", name: "Image", description: "Add an image with accessible text." }');
    expect(builder).toContain("LegacyBlockContentFields");
    expect(builder).toContain("Basic blocks");
    expect(builder).toContain('type: "location", name: "Location"');
    expect(builder).toContain('type: "checklist", name: "Checklist"');
    expect(builder).not.toContain("Current content\n        <textarea");
    const preview = source(
      "src/app/(public)/dashboard/guidebooks/[guidebookId]/preview/page.tsx",
    );
    expect(preview).toContain("PublicGuidebookExperience");
    expect(preview).toContain("index: false");
    expect(preview).toContain("editablePreview");
  });

  it("does not expose the ordinary unnamed-customer fallback", () => {
    const customerPicker = source(
      "src/app/actions/guidebook-admin-creation.ts",
    );
    expect(customerPicker).not.toContain('"Unnamed customer"');
    expect(customerPicker).toContain("Profile incomplete —");
    expect(customerPicker).toContain("repairCustomerIdentityAction");
    expect(customerPicker).toContain("repair_customer_identity");
  });

  it("captures canonical names through every customer commerce account path", () => {
    for (const path of [
      "src/app/actions/commerce-account.ts",
      "src/app/actions/guidebook-commerce.ts",
      "src/app/actions/furnishing-commerce.ts",
      "src/app/actions/investment-commerce.ts",
    ]) {
      const action = source(path);
      expect(action).toContain("fullName:");
      expect(action).toContain("full_name: fullName");
    }
  });

  it("enforces the in-review edit lock at the server command boundary", () => {
    const actions = source("src/app/actions/guidebook-authoring.ts");
    expect(actions).toContain('code: "DRAFT_IN_REVIEW"');
    expect(actions).toContain("drafts.reviewLock");
  });
});

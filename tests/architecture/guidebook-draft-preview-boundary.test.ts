import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Guidebook durable draft preview boundary", () => {
  const action = readFileSync("src/app/actions/guidebook-studio.ts", "utf8");
  const preview = readFileSync(
    "src/app/(dashboard)/dashboard/guidebooks/[guidebookId]/preview/page.tsx",
    "utf8",
  );
  const authoring = readFileSync(
    "src/components/guidebooks/guidebook-authoring-workspace.tsx",
    "utf8",
  );

  it("projects preview sections from the canonical durable draft", () => {
    expect(action).toContain("new SupabaseGuidebookDraftRepository(admin).load");
    expect(action).toContain("draftSections: durableDraft");
    expect(preview).toContain("sections={result.draftSections}");
    expect(preview).not.toContain("sections={result.sections}");
  });

  it("refreshes publication readiness after a successful authoring command", () => {
    expect(authoring).toContain('setState("saved");');
    expect(authoring).toContain("router.refresh();");
    expect(authoring).toContain('saving ? "Saving…" : "Save block"');
  });
});

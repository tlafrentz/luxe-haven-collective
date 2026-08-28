import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("FS-008G final authority boundaries", () => {
  it("does not accept selection, plan, or package identity and revisions from forms", () => {
    const project = read("src/components/furnishing/project-workspace-v1.tsx");
    const packages = read(
      "src/components/furnishing/package-library-workspace.tsx",
    );
    expect(project).not.toMatch(
      /name="(?:selectionId|expectedRevision|planId)"/,
    );
    expect(packages).not.toMatch(
      /name="(?:packageId|versionId|itemId|status)"/,
    );
    expect(project).toContain('name="commandContextId"');
    expect(packages).toContain('name="commandContextId"');
  });

  it("hydrates target identity and revision after resolving an opaque context", () => {
    const project = read("src/app/actions/furnishing-project-workspace.ts");
    const packages = read("src/app/actions/furnishing-packages.ts");
    expect(project).toContain("resolveFurnishingCommandContext");
    expect(project).toContain('.select("revision")');
    expect(packages).toContain("resolveFurnishingCommandContext");
  });

  it("issues no installation command target and fails internal-cohort writes closed", () => {
    const context = read(
      "src/features/furnishing-studio/server-command-context.ts",
    );
    const actions = read("src/app/actions/furnishing-installation.ts");
    const workspace = read(
      "src/components/furnishing/installation-workspace.tsx",
    );
    expect(context).not.toMatch(/\| "installation"/);
    expect(actions).toContain(
      "FS008G_INSTALLATION_UNAVAILABLE_FOR_INTERNAL_COHORT",
    );
    const scope = actions.slice(actions.indexOf("async function scope"), actions.indexOf("const refresh"));
    expect(scope.indexOf("FS008G_INSTALLATION_UNAVAILABLE_FOR_INTERNAL_COHORT")).toBeLessThan(scope.indexOf("assertFurnishingActivationMutationDisabled"));
    expect(workspace).toContain("if (!availability.available)");
    expect(workspace).toMatch(/No\s+installation project or schedule can be created/);
  });
});

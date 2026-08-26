import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("furnishing project detail readiness", () => {
  it("does not query a UUID package key when the project has no package", () => {
    const action = read("src/app/actions/furnishing-project-workspace.ts");
    const detail = action.slice(
      action.indexOf("export async function getProjectWorkspace"),
      action.indexOf("const offerProjection"),
    );

    expect(detail).toContain("project.furnishing_package_version_id\n      ? db");
    expect(detail).toContain("Promise.resolve({ data: null, error: null })");
  });

  it("withholds plan generation and explains incomplete setup", () => {
    const workspace = read("src/components/furnishing/project-workspace-v1.tsx");
    const detail = workspace.slice(
      workspace.indexOf("export async function ProjectWorkspace"),
      workspace.indexOf("function SelectionCard"),
    );

    expect(detail).toContain('!project.furnishing_package_version_id ? "approved package"');
    expect(detail).toContain('!rooms.length ? "canonical rooms"');
    expect(detail).toContain('target === null ? "target budget"');
    expect(detail).toContain("Project setup is incomplete");
    expect(detail).toContain(") : canGeneratePlan ? (");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const action = readFileSync("src/app/actions/furnishing-packages.ts", "utf8");

describe("FS-008G C8-D property-package persistence", () => {
  it("uses the canonical lifecycle column and opaque workspace context", () => {
    const body = action.slice(action.indexOf("export async function createPropertyPackageAction"), action.indexOf("export async function getPropertyPackage"));
    expect(body).toContain('lifecycle_status: "draft"');
    expect(body).toContain("workspace_id: command.workspaceId");
    expect(body).not.toMatch(/\n\s+status:\s*"draft"/);
    expect(body).not.toContain('value(formData, "workspaceId")');
  });
});

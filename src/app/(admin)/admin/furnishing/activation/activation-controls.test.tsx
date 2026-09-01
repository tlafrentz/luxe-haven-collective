import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("legacy furnishing activation compatibility", () => {
  it("redirects the legacy URL to canonical Release Controls", () => {
    expect(
      read("src/app/(admin)/admin/furnishing/activation/page.tsx"),
    ).toContain('redirect("/admin/furnishing/release-controls")');
  });

  it("resolves the canonical summary through the governed server boundary", () => {
    const page = read(
      "src/app/(admin)/admin/furnishing/release-controls/page.tsx",
    );
    expect(page).toContain('requireReleaseControlAccess("view")');
    expect(page).toContain('p_target: "global"');
    expect(page).toContain('rpc("resolve_furnishing_activation_control"');
  });

  it("resolves exact workspace context without a free-form identifier", () => {
    const page = read(
      "src/app/(admin)/admin/furnishing/release-controls/workspaces/[workspaceId]/page.tsx",
    );
    expect(page).toContain('p_target: "workspace"');
    expect(page).toContain("p_target_id: workspaceId");
    expect(page).not.toContain("workspace ID");
  });
});

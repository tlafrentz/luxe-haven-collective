import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Reports canonical navigation boundary", () => {
  const landing = readFileSync("src/app/(dashboard)/dashboard/reports/page.tsx", "utf8");
  const actions = readFileSync("src/app/actions/reporting.ts", "utf8");

  it("routes the canonical overview, library, and generation workspace", () => {
    for (const route of ["/dashboard/reports", "/dashboard/reports/library", "/dashboard/reports/new"])
      expect(landing).toContain(`href=\"${route}\"`);
    expect(landing).not.toContain("?audience=");
    expect(landing).not.toContain('href="/dashboard/investments/reports"');
  });

  it("renders governed definitions from the server catalog rather than hard-coded templates", () => {
    expect(landing).toContain("options.definitions.map");
    expect(landing).toContain("CatalogCard");
    expect(landing).not.toContain("/dashboard/reports/new?type=${type}");
  });

  it("resolves commerce access for the authorized report workspace", () => {
    expect(actions).toContain("getCommerceAccessWorkspace({ workspaceId: access.workspaceId })");
    expect(actions).toContain("getCommerceAccessWorkspace({ workspaceId })");
  });
});

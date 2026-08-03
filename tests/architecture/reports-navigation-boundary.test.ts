import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Reports canonical navigation boundary", () => {
  const landing = readFileSync("src/app/(dashboard)/dashboard/reports/page.tsx", "utf8");
  const actions = readFileSync("src/app/actions/reporting.ts", "utf8");

  it("routes every landing tab to its stable category workspace", () => {
    for (const category of ["executive", "owner", "investment", "operations", "custom"])
      expect(landing).toContain(`href=\"/dashboard/reports/${category}\"`);
    expect(landing).not.toContain("?audience=");
    expect(landing).not.toContain('href="/dashboard/investments/reports"');
  });

  it("routes templates to governed definitions rather than the legacy composer", () => {
    for (const id of [
      "executive-performance-summary",
      "owner-statement",
      "acquisition-underwriting",
      "weekly-operations-summary",
      "custom-report-builder",
    ]) expect(landing).toContain(id);
    expect(landing).not.toContain("/dashboard/reports/new?type=${type}");
  });

  it("resolves commerce access for the authorized report workspace", () => {
    expect(actions).toContain("getCommerceAccessWorkspace({ workspaceId: access.workspaceId })");
    expect(actions).toContain("getCommerceAccessWorkspace({ workspaceId })");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { businessServicesActionContracts, platformRouteDefinitions } from "@/platform/experience";

const read = (path: string) => readFileSync(path, "utf8");

describe("PS-001D Business and Services stabilization contract", () => {
  it("resolves Properties and Bookings through canonical workspace access", () => {
    const properties = read("src/app/(portal)/properties/page.tsx");
    const bookings = read("src/app/(portal)/bookings/page.tsx");
    expect(properties).toContain("resolveWorkspaceAccessContext");
    expect(properties).toContain("workspaceId: access.workspaceId");
    expect(bookings).toContain("resolveWorkspaceAccessContext");
    expect(bookings).toContain("getBookings(repository, user.id");
    expect(bookings).toContain("workspaceId: access.workspaceId");
    expect(bookings).toContain("propertyWorkspaceId: access.workspaceId");
    expect(bookings).not.toContain("workspaceId: user.id");
    expect(bookings).not.toContain("propertyWorkspaceId: user.id");
  });

  it("keeps Add Property intent explicit and accepts only registered return targets", () => {
    const add = read("src/app/(portal)/properties/new/page.tsx");
    const connected = read(
      "src/app/(dashboard)/dashboard/workspace/connected-systems/page.tsx",
    );
    expect(add).toContain("Enter property manually");
    expect(add).toContain("Import from connected system");
    expect(add).toContain("/dashboard/furnishing/projects/new");
    expect(connected).toContain('requestedReturn === "/properties"');
    expect(connected).not.toMatch(/returnTo\s*=\s*requestedReturn\s*;/);
  });

  it("enforces Furnishing entitlement after workspace authorization", () => {
    const access = read("src/app/actions/furnishing-access.ts");
    expect(access).toContain('.from("customer_account_memberships")');
    expect(access).toContain('.from("commercial_entitlements")');
    expect(access).toContain('.eq("capability_code", "furnishing.project.access")');
    expect(access).not.toContain("commerce_entitlement_grants");
    for (const path of [
      "src/app/actions/furnishing-project-workspace.ts",
      "src/app/actions/furnishing-procurement.ts",
      "src/app/actions/furnishing-installation.ts",
    ]) expect(read(path)).toContain("assertFurnishingEntitlement");
    expect(read("src/app/(dashboard)/dashboard/furnishing/projects/new/page.tsx"))
      .toContain("await getProjectSetup()");
  });

  it("routes customer Furnishing property creation through canonical Properties", () => {
    const workspace = read("src/components/furnishing/project-workspace-v1.tsx");
    expect(workspace).toContain(
      "/properties/new?returnTo=%2Fdashboard%2Ffurnishing%2Fprojects%2Fnew",
    );
    expect(workspace).toContain("customer ? <Link");
  });

  it("does not expose database error messages from customer Furnishing commands", () => {
    for (const path of [
      "src/app/actions/furnishing-project-workspace.ts",
      "src/app/actions/furnishing-procurement.ts",
      "src/app/actions/furnishing-installation.ts",
    ]) expect(read(path)).not.toMatch(/throw new Error\([^)]*\.message/);
  });

  it("registers exposed report, Guidebook, and Furnishing deep links", () => {
    for (const path of [
      "/dashboard/reports/[reportId]/versions/[versionId]",
      "/dashboard/guidebooks/[guidebookId]/edit",
      "/dashboard/guidebooks/[guidebookId]/publish",
      "/dashboard/guidebooks/[guidebookId]/versions/[versionId]/preview",
      "/dashboard/furnishing/projects/[projectId]",
      "/dashboard/furnishing/projects/[projectId]/procurement",
      "/dashboard/furnishing/projects/[projectId]/installation",
    ]) expect(platformRouteDefinitions.some((route) => route.pathPattern === path)).toBe(true);
  });

  it("keeps FS-008 and catalog activation outside the customer correction", () => {
    const changed = [
      read("src/app/actions/furnishing-access.ts"),
      read("src/app/actions/furnishing-project-workspace.ts"),
    ].join("\n");
    expect(changed).not.toMatch(/FS-008|catalog activation|activateCatalog/i);
  });

  it("has no unresolved Business or Services action inventory entries", () => {
    expect(new Set(businessServicesActionContracts.map((item) => item.id)).size)
      .toBe(businessServicesActionContracts.length);
    for (const item of businessServicesActionContracts) {
      expect(item.canonicalTarget).not.toMatch(/unknown|todo|no-op|not wired/i);
      expect(item.authorization.length).toBeGreaterThan(0);
      expect(item.verificationReference).toMatch(/^PS-001D-/);
    }
  });
});

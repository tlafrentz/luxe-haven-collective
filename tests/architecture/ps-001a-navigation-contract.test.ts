import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clientWorkspaceNavigation,
  customerRouteSmokeRegistry,
  matchesNavigationRoute,
  platformRouteDefinitions,
} from "../../src/platform/experience";

const appRoots = ["(dashboard)", "(portal)"] as const;
const pathname = (value: string) => value.split("?")[0];
const pagePath = (value: string) => `${value === "/dashboard" ? "/dashboard" : value}`
  .replace(/^\//, "")
  .concat("/page.tsx");

describe("PS-001A canonical shell and navigation contract", () => {
  it("keeps the approved global IA in one authoritative definition", () => {
    expect(clientWorkspaceNavigation.map(({ label }) => label)).toEqual([
      "Home", "Workspace",
      "Observe", "Understand", "Decide", "Execute", "Learn",
      "Properties", "Bookings", "Guest Communications", "Reports",
      "Guidebook Studio", "Furnishing Studio",
    ]);
    expect(clientWorkspaceNavigation.some(({ label }) => label === "HPM")).toBe(false);
  });

  it("maps every smoke route to a real registry entry and existing page", () => {
    const routeIds = new Set(platformRouteDefinitions.map(({ id }) => id));
    for (const entry of customerRouteSmokeRegistry) {
      expect(routeIds.has(entry.routeId), `missing route definition: ${entry.routeId}`).toBe(true);
      const relative = pagePath(pathname(entry.path));
      expect(appRoots.some((root) => existsSync(resolve("src/app", root, relative))), `missing page: ${entry.path}`).toBe(true);
    }
  });

  it("selects exactly one canonical global destination for every smoke route", () => {
    for (const entry of customerRouteSmokeRegistry) {
      const active = clientWorkspaceNavigation.filter(({ activeMatch }) => activeMatch && matchesNavigationRoute(pathname(entry.path), activeMatch));
      expect(active.map(({ id }) => id), entry.path).toEqual([entry.expectedActiveNavigationId]);
      expect(platformRouteDefinitions.find(({ id }) => id === entry.routeId)?.navigationItemId).toBe(entry.expectedActiveNavigationId);
    }
  });

  it("retains permanent regression guards for known failures", () => {
    const investmentShell = readFileSync(resolve("src/features/investment-intelligence/components/investment-workspace-shell-navigation.tsx"), "utf8");
    const attention = readFileSync(resolve("src/app/(dashboard)/dashboard/understand/executive/attention/page.tsx"), "utf8");
    const properties = readFileSync(resolve("src/app/(portal)/properties/page.tsx"), "utf8");
    expect(investmentShell).not.toContain('label: "Reports"');
    expect(investmentShell).not.toContain('label: "Settings"');
    expect(attention).toContain("searchParams");
    expect(attention).toContain("aria-selected");
    expect(properties).toContain('href="/properties/new"');
  });
});

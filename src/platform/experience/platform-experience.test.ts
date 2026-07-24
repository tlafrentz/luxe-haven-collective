import { describe, expect, it } from "vitest";
import { buildPlatformBreadcrumbs, clientWorkspaceNavigation, matchesNavigationRoute, operationsConsoleNavigation, platformRouteDefinitions, resolveNavigation, resolveUserCapabilities, resolveWorkspaceForPath } from "./index";

describe("workspace-driven platform experience", () => {
  it("defines lifecycle capabilities in canonical order", () => {
    const lifecycle = clientWorkspaceNavigation.filter(item => item.group === "hpm");
    expect(lifecycle.map(item => item.lifecycleStage)).toEqual(["observe", "understand", "understand", "decide", "execute", "learn"]);
    expect(lifecycle.map(item => item.workspaceLabel)).toEqual(["Revenue Intelligence", "Executive Intelligence", "Business health & capital", "Investment Intelligence", "Action Center", "Learning Intelligence"]);
    expect(lifecycle.every(item => !("children" in item))).toBe(true);
    expect(new Set(lifecycle.map(item => item.href).filter(Boolean)).size).toBe(lifecycle.filter(item => item.href).length);
  });

  it("keeps business, service, operations, and infrastructure concepts separate", () => {
    expect(clientWorkspaceNavigation.some(item => item.group === "business" && item.id === "properties")).toBe(true);
    expect(clientWorkspaceNavigation.some(item => item.group === "services" && item.id === "guidebook-studio")).toBe(true);
    expect(operationsConsoleNavigation.some(item => item.group === "operations" && item.id === "operations-customers")).toBe(true);
    expect(operationsConsoleNavigation.some(item => item.group === "infrastructure" && item.id === "platform-integrations")).toBe(true);
    expect(operationsConsoleNavigation.some(item => item.id === "operations-organizations")).toBe(false);
  });

  it.each([
    ["/dashboard/investments", "decide"],
    ["/dashboard/investments/new", "decide"],
    ["/dashboard/investments/opportunities/abc", "decide"],
    ["/dashboard/investments/portfolio/abc/analyses/xyz", "decide"],
    ["/dashboard/insights", "observe"],
    ["/dashboard/actions/abc", "execute"],
    ["/dashboard/portfolio", "understand"],
    ["/dashboard/portfolio/workspace", "understand"],
    ["/dashboard/learning", "learn"],
    ["/dashboard/learning/workspace", "learn"],
  ] as const)("resolves %s to %s", (path, workspace) => expect(resolveWorkspaceForPath(path)).toBe(workspace));

  it("does not resolve unrelated routes to an HPM workspace", () => {
    expect(resolveWorkspaceForPath("/dashboard")).toBeUndefined();
    expect(resolveWorkspaceForPath("/properties")).toBeUndefined();
    expect(matchesNavigationRoute("/dashboard/investments-old", { type: "prefix", prefix: "/dashboard/investments" })).toBe(false);
  });

  it("filters internal operations from external roles", () => {
    expect(resolveNavigation(operationsConsoleNavigation, resolveUserCapabilities({ authenticated: true, role: "owner" }))).toHaveLength(0);
    expect(resolveNavigation(operationsConsoleNavigation, resolveUserCapabilities({ authenticated: true, role: "admin" })).some(item => item.id === "platform-integrations")).toBe(true);
  });

  it("owns canonical and legacy investment routes from Decide", () => {
    const investmentRoutes = platformRouteDefinitions.filter(route => route.pathPattern.startsWith("/dashboard/investments"));
    expect(investmentRoutes.length).toBeGreaterThan(5);
    expect(investmentRoutes.every(route => route.hpmStage === "decide" && route.navigationItemId === "decide")).toBe(true);
  });

  it("owns Portfolio Intelligence as an Understand lifecycle destination", () => {
    const route = platformRouteDefinitions.find(item => item.pathPattern === "/dashboard/portfolio");
    expect(route).toMatchObject({ hpmStage: "understand", businessWorkspace: "portfolio", navigationItemId: "portfolio-intelligence" });
    expect(clientWorkspaceNavigation.find(item => item.id === "portfolio-intelligence")).toMatchObject({ group: "hpm", href: "/dashboard/portfolio", icon: "portfolio" });
    expect(platformRouteDefinitions.find(item => item.pathPattern === "/dashboard/portfolio/workspace")).toMatchObject({ hpmStage: "understand", navigationItemId: "portfolio-intelligence" });
  });

  it("keeps business navigation limited to operational record sets", () => {
    expect(clientWorkspaceNavigation.filter(item => item.group === "business").map(item => item.label)).toEqual(["Properties", "Bookings", "Messages", "Reports"]);
    expect(clientWorkspaceNavigation.some(item => item.group === "business" && item.id === "portfolio-intelligence")).toBe(false);
  });

  it("separates customer guidebook service consumption from internal delivery", () => {
    const customerService = clientWorkspaceNavigation.find(item => item.id === "guidebook-studio");
    const internalService = operationsConsoleNavigation.find(item => item.id === "guidebook-projects");
    expect(customerService).toMatchObject({ group: "services", label: "Guidebook Studio", availability: "coming-soon", description: "Create and manage your guest guidebook" });
    expect(internalService).toMatchObject({ group: "services", label: "Guidebook Projects", availability: "coming-soon", description: "Manage guidebook service delivery" });
    expect(customerService?.label).not.toBe(internalService?.label);
  });

  it.each(["/dashboard/portfolio", "/dashboard/portfolio/workspace"])("activates Portfolio Intelligence for %s", path => {
    const item = clientWorkspaceNavigation.find(entry => entry.id === "portfolio-intelligence");
    expect(item && matchesNavigationRoute(path, item.activeMatch)).toBe(true);
  });

  it("has no duplicate hrefs within either shell", () => {
    for (const navigation of [clientWorkspaceNavigation, operationsConsoleNavigation]) {
      const hrefs = navigation.flatMap(item => item.href ? [item.href] : []);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });

  it("builds consistent Investment Intelligence breadcrumbs", () => {
    const crumbs = buildPlatformBreadcrumbs({ stage: "Decide", workspace: "Investment Intelligence", parentHref: "/dashboard/investments", currentLabel: "New Analysis" });
    expect(crumbs.map(item => item.label)).toEqual(["Home", "Decide", "Investment Intelligence", "New Analysis"]);
    expect(crumbs.at(-1)?.current).toBe(true);
    expect(crumbs.at(-1)?.href).toBeUndefined();
  });
});

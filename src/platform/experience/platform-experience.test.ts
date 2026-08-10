import { describe, expect, it } from "vitest";
import { buildPlatformBreadcrumbs, clientWorkspaceNavigation, matchesNavigationRoute, operationsConsoleNavigation, platformRouteDefinitions, resolveNavigation, resolveUserCapabilities, resolveWorkspaceForPath } from "./index";

describe("workspace-driven platform experience", () => {
  it("defines lifecycle capabilities in canonical order", () => {
    const lifecycle = clientWorkspaceNavigation.filter(item => "lifecycleStage" in item);
    expect(lifecycle.map(item => item.lifecycleStage)).toEqual(["observe", "understand", "decide", "execute", "learn"]);
    expect(lifecycle.map(item => item.label)).toEqual(["Observe", "Understand", "Decide", "Execute", "Learn"]);
    expect(lifecycle.every(item => !("children" in item))).toBe(true);
    expect(new Set(lifecycle.map(item => item.href).filter(Boolean)).size).toBe(lifecycle.filter(item => item.href).length);
  });

  it("presents lifecycle stages as direct workspace destinations", () => {
    const lifecycle = clientWorkspaceNavigation.filter(item => "lifecycleStage" in item);
    expect(lifecycle.every(item => item.kind === "product" && item.level === 1 && !("parentId" in item))).toBe(true);
    expect(clientWorkspaceNavigation.find(item => item.id === "understand")).toMatchObject({ href: "/dashboard/understand/executive", icon: "understand" });
  });

  it("keeps intelligence lenses beneath their lifecycle stages", () => {
    expect(clientWorkspaceNavigation.find(item => item.id === "observe")).toMatchObject({ href: "/dashboard/observe/revenue", level: 1 });
    expect(clientWorkspaceNavigation.find(item => item.id === "understand")).toMatchObject({ href: "/dashboard/understand/executive", level: 1 });
    expect(clientWorkspaceNavigation.some(item => ["Revenue Intelligence", "Financial Intelligence", "Executive Intelligence", "Portfolio Intelligence"].includes(item.label))).toBe(false);
    expect(platformRouteDefinitions.find(item => item.pathPattern === "/dashboard/observe/financial")).toMatchObject({ hpmStage: "observe", businessWorkspace: "financial" });
    expect(platformRouteDefinitions.find(item => item.pathPattern === "/dashboard/understand/portfolio")).toMatchObject({ hpmStage: "understand", businessWorkspace: "portfolio" });
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
    ["/dashboard/observe/revenue", "observe"],
    ["/dashboard/observe/financial", "observe"],
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

  it("omits empty groups and requires explicit feature participation", () => {
    const cleanerNavigation = resolveNavigation(clientWorkspaceNavigation, resolveUserCapabilities({ authenticated: true, role: "cleaner" }));
    expect(cleanerNavigation.some(item => item.id === "understand")).toBe(false);
    const flagged = [{ ...clientWorkspaceNavigation[0], id: "beta-product", featureFlag: "beta-product" }];
    expect(resolveNavigation(flagged, resolveUserCapabilities({ authenticated: true, role: "owner" }))).toHaveLength(0);
    expect(resolveNavigation(flagged, resolveUserCapabilities({ authenticated: true, role: "owner" }), new Set(["beta-product"]))).toHaveLength(1);
  });

  it("shows the unified HPM workspace only when its server-provided flag is enabled", () => {
    const capabilities = resolveUserCapabilities({ authenticated: true, role: "owner" });
    expect(resolveNavigation(clientWorkspaceNavigation, capabilities).some(item => item.id === "hpm-workspace")).toBe(false);
    const enabled = resolveNavigation(clientWorkspaceNavigation, capabilities, new Set(["hpm-unified-workspace"]));
    expect(enabled.find(item => item.id === "hpm-workspace")).toMatchObject({ label: "HPM", href: "/dashboard/hpm", description: "Hospitality Performance Management" });
    const item = enabled.find(entry => entry.id === "hpm-workspace");
    expect(item?.activeMatch && matchesNavigationRoute("/dashboard/hpm/lifecycle/thread-1", item.activeMatch)).toBe(true);
  });

  it("owns canonical and legacy investment routes from Decide", () => {
    const investmentRoutes = platformRouteDefinitions.filter(route => route.pathPattern.startsWith("/dashboard/investments"));
    expect(investmentRoutes.length).toBeGreaterThan(5);
    expect(investmentRoutes.every(route => route.hpmStage === "decide" && route.navigationItemId === "investment-intelligence")).toBe(true);
  });

  it("owns Portfolio Intelligence as an Understand lifecycle destination", () => {
    const route = platformRouteDefinitions.find(item => item.pathPattern === "/dashboard/portfolio");
    expect(route).toMatchObject({ hpmStage: "understand", businessWorkspace: "portfolio", navigationItemId: "portfolio-intelligence" });
    expect(clientWorkspaceNavigation.find(item => item.id === "understand")).toMatchObject({ group: "hpm", level: 1, href: "/dashboard/understand/executive", icon: "understand" });
    expect(platformRouteDefinitions.find(item => item.pathPattern === "/dashboard/portfolio/workspace")).toMatchObject({ hpmStage: "understand", navigationItemId: "portfolio-intelligence" });
  });

  it("keeps business navigation limited to operational record sets", () => {
    expect(clientWorkspaceNavigation.filter(item => item.group === "business").map(item => item.label)).toEqual(["Properties", "Bookings", "Guest Communications", "Reports"]);
    expect(clientWorkspaceNavigation.some(item => item.group === "business" && item.id === "portfolio-intelligence")).toBe(false);
  });

  it("separates customer guidebook service consumption from internal delivery", () => {
    const customerService = clientWorkspaceNavigation.find(item => item.id === "guidebook-studio");
    const internalService = operationsConsoleNavigation.find(item => item.id === "guidebook-projects");
    expect(customerService).toMatchObject({ group: "services", label: "Guidebook Studio", availability: "available", href: "/dashboard/guidebooks" });
    expect(internalService).toMatchObject({ group: "services", label: "Guidebook Studio", availability: "available", href: "/admin/guidebooks", description: "Create, publish, and govern guest guidebooks" });
    expect(customerService?.href).not.toBe(internalService?.href);
    expect(customerService?.experience).toBe("client-workspace");
    expect(internalService?.experience).toBe("operations-console");
  });

  it.each(["/dashboard/portfolio", "/dashboard/portfolio/workspace"])("activates Understand for %s", path => {
    const item = clientWorkspaceNavigation.find(entry => entry.id === "understand");
    expect(item?.activeMatch && matchesNavigationRoute(path, item.activeMatch)).toBe(true);
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

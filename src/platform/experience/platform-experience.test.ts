import { describe, expect, it } from "vitest";
import { buildPlatformBreadcrumbs, clientWorkspaceNavigation, matchesNavigationRoute, operationsConsoleNavigation, platformRouteDefinitions, resolveNavigation, resolveUserCapabilities, resolveWorkspaceForPath } from "./index";

describe("workspace-driven platform experience", () => {
  it("defines five flat lifecycle workspaces in canonical order", () => {
    const lifecycle = clientWorkspaceNavigation.filter(item => item.group === "hpm");
    expect(lifecycle.map(item => item.lifecycleStage)).toEqual(["observe", "understand", "decide", "execute", "learn"]);
    expect(lifecycle.map(item => item.workspaceLabel)).toEqual(["Revenue Intelligence", "Executive Intelligence", "Investment Intelligence", "Action Center", "Continuous Improvement"]);
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

  it("owns Portfolio Intelligence as a separate Understand business destination", () => {
    const route = platformRouteDefinitions.find(item => item.pathPattern === "/dashboard/portfolio");
    expect(route).toMatchObject({ hpmStage: "understand", businessWorkspace: "portfolio", navigationItemId: "portfolio-intelligence" });
    expect(clientWorkspaceNavigation.find(item => item.id === "portfolio-intelligence")).toMatchObject({ group: "business", href: "/dashboard/portfolio" });
    expect(platformRouteDefinitions.find(item => item.pathPattern === "/dashboard/portfolio/workspace")).toMatchObject({ hpmStage: "understand", navigationItemId: "portfolio-intelligence" });
  });

  it("builds consistent Investment Intelligence breadcrumbs", () => {
    const crumbs = buildPlatformBreadcrumbs({ stage: "Decide", workspace: "Investment Intelligence", parentHref: "/dashboard/investments", currentLabel: "New Analysis" });
    expect(crumbs.map(item => item.label)).toEqual(["Home", "Decide", "Investment Intelligence", "New Analysis"]);
    expect(crumbs.at(-1)?.current).toBe(true);
    expect(crumbs.at(-1)?.href).toBeUndefined();
  });
});

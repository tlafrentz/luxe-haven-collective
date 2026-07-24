import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PortfolioIntelligenceDashboardState } from "../application";
import { PortfolioDashboard, PortfolioDashboardSkeleton } from "./portfolio-dashboard";

const portfolio = Object.freeze({ id: "portfolio-ui", name: "Luxe Haven Portfolio", activePropertyCount: 0, activeOpportunityCount: 0, reportingCurrency: "USD" as const, updatedAt: new Date("2026-07-23"), observationWindow: Object.freeze({ start: new Date("2025-07-01"), end: new Date("2026-06-30") }), lifecycle: "empty" as const, workspaceDestination: "/dashboard/portfolio/workspace?portfolio=portfolio-ui" });
const unavailableCapital = Object.freeze({ status: "unavailable" as const, reportingCurrency: "USD" as const, available: null, protected: null, committed: null, nearTermObligations: null, deployable: null, unfunded: null, reserveCoverage: null, mandatoryRequired: null, mandatoryFunded: null, mostUrgentObligation: null, confidence: null, destination: "/dashboard/portfolio/workspace" });

describe("Portfolio Intelligence Dashboard presentation", () => {
  it("renders an intentional empty state without health or recommendation fabrication", () => {
    const state: PortfolioIntelligenceDashboardState = { status: "empty", dashboard: { portfolio, capital: unavailableCapital, limitations: [] } };
    const html = renderToStaticMarkup(<PortfolioDashboard state={state} />);
    expect(html).toContain("Build your portfolio intelligence foundation");
    expect(html).toContain("No health score or recommendation is shown");
    expect(html).not.toContain("Critical");
  });

  it("renders formation stage without mature diversification language", () => {
    const state: PortfolioIntelligenceDashboardState = { status: "formation-stage", dashboard: { portfolio: { ...portfolio, lifecycle: "formation-stage", activeOpportunityCount: 2 }, capital: unavailableCapital, allocation: { status: "unavailable", posture: null, confidence: null, primaryConstraint: null, primaryCandidate: null, destination: "/workspace" }, recommendations: { status: "unavailable", posture: null, criticalCount: 0, highCount: 0, totalActiveCount: 0, topRecommendations: [], conflictingRecommendations: [], stale: false, destination: "/workspace" }, limitations: [] } };
    const html = renderToStaticMarkup(<PortfolioDashboard state={state} />);
    expect(html).toContain("Formation stage");
    expect(html).toContain("Mature operating health and diversification assumptions are not applied");
  });

  it("announces progressive loading and honors reduced motion", () => {
    const html = renderToStaticMarkup(<PortfolioDashboardSkeleton />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading Portfolio Intelligence dashboard");
    expect(html).toContain("motion-reduce:animate-none");
  });
});

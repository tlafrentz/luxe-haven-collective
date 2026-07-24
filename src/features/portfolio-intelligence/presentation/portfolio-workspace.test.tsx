import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PortfolioIntelligenceWorkspaceState } from "../application";
import { PortfolioWorkspace, PortfolioWorkspaceSkeleton } from "./index";

const summary = Object.freeze({
  id: "portfolio-ui", name: "Luxe Haven Portfolio", strategySummary: "Growth with liquidity protection",
  activePropertyCount: 1, activeOpportunityCount: 2, reportingCurrency: "USD" as const,
  updatedAt: new Date("2026-07-23T12:00:00Z"),
  observationWindow: Object.freeze({ start: new Date("2025-07-01"), end: new Date("2026-06-30") }),
});

describe("Portfolio Intelligence presentation", () => {
  it("renders empty and formation stage without a fake health score", () => {
    const empty: PortfolioIntelligenceWorkspaceState = { status: "insufficient-data", portfolio: { ...summary, activePropertyCount: 0, activeOpportunityCount: 0 }, gaps: [{ code: "PORTFOLIO_HAS_NO_ACTIVE_PROPERTIES", section: "composition", impact: "blocking", missingFields: ["activeProperties"], confidenceReduced: true, rankingBlocked: false }], availableSections: ["composition"] };
    const formation: PortfolioIntelligenceWorkspaceState = { status: "formation-stage", portfolio: { ...summary, activePropertyCount: 0 }, formation: { activeOpportunities: 2, capital: null, allocation: null, limitations: [] } };
    const emptyHtml = renderToStaticMarkup(<PortfolioWorkspace state={empty} />);
    expect(emptyHtml).toContain("ready to be built");
    expect(emptyHtml).toContain("No health score has been fabricated");
    expect(renderToStaticMarkup(<PortfolioWorkspace state={formation} />)).toContain("Formation stage");
  });

  it("distinguishes unavailable assessment state from poor performance", () => {
    const state: PortfolioIntelligenceWorkspaceState = { status: "health-unavailable", portfolio: summary, limitations: [{ code: "PORTFOLIO_WORKSPACE_HEALTH_UNAVAILABLE", section: "health", impact: "material", guidance: "Evaluate health." }] };
    const html = renderToStaticMarkup(<PortfolioWorkspace state={state} />);
    expect(html).toContain("Portfolio health is unavailable");
    expect(html).toContain("not replaced with zero");
    expect(html).not.toContain("Critical");
  });

  it("announces progressive loading and respects reduced motion", () => {
    const html = renderToStaticMarkup(<PortfolioWorkspaceSkeleton />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading Portfolio Intelligence workspace");
    expect(html).toContain("motion-reduce:animate-none");
  });
});

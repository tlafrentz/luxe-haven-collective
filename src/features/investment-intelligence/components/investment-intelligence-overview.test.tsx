import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvestmentIntelligenceOverview } from "./investment-intelligence-overview";

const metrics = { evaluating: 0, researching: 0, shortlisted: 0, underContract: 0, acquired: 0 };

describe("Investment Intelligence overview", () => {
  it("renders the live scenarios workspace action", () => {
    const html = renderToStaticMarkup(<InvestmentIntelligenceOverview view={{ metrics: { ...metrics, researching: 2, shortlisted: 1 }, opportunities: [], empty: true }} scenarioCount={12} />);
    expect(html).toContain("Investment Intelligence");
    expect(html).toContain('href="/dashboard/investments/new"');
    expect(html).toContain('href="/dashboard/investments/opportunities"');
    expect(html).toContain('href="/dashboard/investments/scenarios"');
    expect(html).toContain("Saved Scenarios");
    expect(html).toContain("12 analyses saved");
    expect(html).toContain("3 active acquisitions");
    expect(html).toContain("Step 1");
    expect(html).not.toContain('href="/dashboard/investments/reports"');
    expect(html).not.toContain("Soon");
    expect(html).toContain("No opportunities yet");
  });

  it("keeps actions available when recent opportunities fail", () => {
    const html = renderToStaticMarkup(<InvestmentIntelligenceOverview failed />);
    expect(html).toContain("Recent opportunities could not be loaded");
    expect(html).toContain('href="/dashboard/investments/new"');
  });
});

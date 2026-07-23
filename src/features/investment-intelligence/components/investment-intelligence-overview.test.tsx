import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvestmentIntelligenceOverview } from "./investment-intelligence-overview";

const metrics = { evaluating: 0, researching: 0, shortlisted: 0, underContract: 0, acquired: 0 };

describe("Investment Intelligence overview", () => {
  it("renders workspace actions and a safe Saved Scenarios state", () => {
    const html = renderToStaticMarkup(<InvestmentIntelligenceOverview view={{ metrics, opportunities: [], empty: true }} />);
    expect(html).toContain("Investment Intelligence");
    expect(html).toContain('href="/dashboard/investments/new"');
    expect(html).toContain('href="/dashboard/investments/opportunities"');
    expect(html).toContain("Saved Scenarios is coming soon");
    expect(html).toContain("No opportunities yet");
  });

  it("keeps actions available when recent opportunities fail", () => {
    const html = renderToStaticMarkup(<InvestmentIntelligenceOverview failed />);
    expect(html).toContain("Recent opportunities could not be loaded");
    expect(html).toContain('href="/dashboard/investments/new"');
  });
});

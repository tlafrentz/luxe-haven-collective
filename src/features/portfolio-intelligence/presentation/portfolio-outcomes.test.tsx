import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPortfolioDecisionOutcomeReview, buildPortfolioOutcomesWorkspace } from "../application/outcomes";
import { portfolioOutcomeFixture } from "../application/outcomes/portfolio-outcomes.test";
import { PortfolioOutcomesError, PortfolioOutcomesSkeleton, PortfolioOutcomesView } from "./portfolio-outcomes";
describe("Portfolio outcomes presentation", () => {
  it("renders outcomes, expected versus actual, assumptions, calibration, strategy, and knowledge accessibly", () => {
    const base = portfolioOutcomeFixture();
    const review = buildPortfolioDecisionOutcomeReview(base.input);
    const workspace = buildPortfolioOutcomesWorkspace({ decisions: [base.decision], candidates: [base.candidate], reviews: [review], readiness: [], role: "owner", evaluatedAt: base.input.reviewedAt });
    const html = renderToStaticMarkup(<PortfolioOutcomesView workspace={workspace} />);
    expect(html).toContain("Outcomes, Learning &amp; Validation");
    expect(html).toContain("Expected versus realized outcomes");
    expect(html).toContain("<caption");
    expect(html).toContain("Assumption validation");
    expect(html).toContain("Recommendation performance");
    expect(html).toContain("Strategy effectiveness");
    expect(html).toContain("Organizational knowledge");
    expect(html).toContain("Historical expectations remain immutable");
  });
  it("renders empty, insufficient, degraded, permission, loading, and error states", () => {
    const base = portfolioOutcomeFixture();
    const make = (state: "empty" | "insufficient-evidence" | "degraded" | "permission-limited") => ({
      ...buildPortfolioOutcomesWorkspace({ decisions: [], candidates: [], reviews: [], readiness: [], role: "owner", evaluatedAt: base.input.reviewedAt }), state,
    });
    expect(renderToStaticMarkup(<PortfolioOutcomesView workspace={make("empty")} />)).toContain("No completed portfolio decisions");
    expect(renderToStaticMarkup(<PortfolioOutcomesView workspace={make("insufficient-evidence")} />)).toContain("Outcome evidence is insufficient");
    expect(renderToStaticMarkup(<PortfolioOutcomesView workspace={make("degraded")} />)).toContain("Outcome evaluation is limited");
    expect(renderToStaticMarkup(<PortfolioOutcomesView workspace={make("permission-limited")} />)).toContain("Learning is read-only");
    expect(renderToStaticMarkup(<PortfolioOutcomesSkeleton />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<PortfolioOutcomesError />)).toContain('role="alert"');
  });
});


import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildPortfolioDecisionWorkspace } from "../application/decisions";
import { portfolioDecisionFixture } from "../application/decisions/portfolio-decisions.test";
import { PortfolioDecisionsError, PortfolioDecisionsSkeleton, PortfolioDecisionsView } from "./portfolio-decisions";
import { PortfolioDecisionReviewControls } from "./portfolio-decision-review-controls";
import { DecisionActionPlanHandoff } from "./decision-action-plan-handoff";

vi.mock("@/app/actions/portfolio-decisions-runtime", () => ({
  createPortfolioDecisionAction: vi.fn(),
  commandPortfolioDecisionAction: vi.fn(),
}));
vi.mock("@/app/actions/execute-plans", () => ({ createExecutePlanFromDecisionAction: vi.fn() }));

describe("Portfolio decisions presentation", () => {
  it("renders candidates, alternatives, capital states, pipeline, conflicts, and expected-value language", () => {
    const { findings } = portfolioDecisionFixture();
    const html = renderToStaticMarkup(<PortfolioDecisionsView workspace={buildPortfolioDecisionWorkspace({ findings, role: "owner" })} />);
    expect(html).toContain("Capital Allocation &amp; Strategic Decisions");
    expect(html).toContain("Capital allocation candidates");
    expect(html).toContain("Maintain Current Strategy");
    expect(html).toContain("Scenario comparison");
    expect(html).toContain("<caption");
    expect(html).toContain("Expected impact is projected");
    expect(html).toContain("Committed");
    expect(html).toContain("Spent");
    expect(html).toContain("Decision pipeline");
  });
  it("renders permission, evidence, degraded, loading, and error states accessibly", () => {
    const { findings } = portfolioDecisionFixture();
    expect(renderToStaticMarkup(<PortfolioDecisionsView workspace={buildPortfolioDecisionWorkspace({ findings, role: "viewer" })} />)).toContain("Review access only");
    const insufficient = { ...findings, state: "insufficient-evidence" as const };
    expect(renderToStaticMarkup(<PortfolioDecisionsView workspace={buildPortfolioDecisionWorkspace({ findings: insufficient, role: "owner" })} />)).toContain("No decision-ready findings");
    const degraded = { ...findings, state: "degraded" as const };
    expect(renderToStaticMarkup(<PortfolioDecisionsView workspace={buildPortfolioDecisionWorkspace({ findings: degraded, role: "owner" })} />)).toContain("Decision evidence may be outdated");
    expect(renderToStaticMarkup(<PortfolioDecisionsSkeleton />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<PortfolioDecisionsError />)).toContain('role="alert"');
  });
  it("renders explicit owner approval controls and a review-only permission state", () => {
    const { candidate, decision } = portfolioDecisionFixture();
    const owner = renderToStaticMarkup(<PortfolioDecisionReviewControls candidate={candidate} decision={decision} canApprove />);
    expect(owner).toContain("Approve selected alternative");
    expect(owner).toContain("Reject recommendation");
    expect(owner).toContain("Defer decision");
    expect(owner).toContain("Request more evidence");
    expect(owner).toContain("Decision rationale");
    expect(owner).toContain("Review date");
    const viewer = renderToStaticMarkup(<PortfolioDecisionReviewControls candidate={candidate} decision={decision} canApprove={false} />);
    expect(viewer).toContain("review-only access");
  });
  it("keeps approval separate from the explicit canonical Action Plan handoff", () => {
    const { decision } = portfolioDecisionFixture();
    const controls = renderToStaticMarkup(<PortfolioDecisionReviewControls candidate={portfolioDecisionFixture().candidate} decision={decision} canApprove />);
    expect(controls).toContain("records the decision");
    expect(controls).toContain("separate Action Plan handoff");
    const handoff = renderToStaticMarkup(<DecisionActionPlanHandoff decisionId={decision.decisionId} />);
    expect(handoff).toContain("Create Action Plan");
    expect(handoff).toContain("does not activate or assign execution");
  });
});

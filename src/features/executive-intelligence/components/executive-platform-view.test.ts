import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type {
  ExecutiveAttentionItem,
  ExecutiveDataQualitySummary,
  ExecutiveHealthSummary,
} from "../domain";
import { ExecutiveDataQuality } from "./executive-data-quality";
import { ExecutiveDecisionSection, ExecutiveExecutionSection, ExecutiveOutcomeSection } from "./executive-lifecycle-summary";
import { ExecutiveAttentionList } from "./executive-attention-list";
import { getExecutiveAttentionDestination } from "./executive-attention-card";
import { PortfolioHealthOverview } from "./portfolio-health-overview";
import { createExecutiveDataQualitySummary } from "../test-support/factories";

const dataQuality: ExecutiveDataQualitySummary = createExecutiveDataQualitySummary({
  availablePillars: ["revenue"], unavailablePillars: ["operations"], confidence: null,
  gaps: [
    { type: "absent-provider", message: "No production Platform Decision provider is configured for this query." },
    { type: "absent-provider", message: "No production Platform Action provider is configured for this query." },
    { type: "absent-provider", message: "No production Platform Outcome provider is configured for this query." },
    { type: "incomplete-scope", message: "Canonical scope is incomplete." },
  ],
  summary: "4 data quality gaps limit this Executive view.",
});

function item(overrides: Partial<ExecutiveAttentionItem> = {}): ExecutiveAttentionItem {
  return { id: "attention-1", rank: 1, source: "recommendation", sourceId: "recommendation-1", title: "Protect revenue",
    summary: "Review an exposed payment.", category: "revenue", urgency: "high", impact: 500, confidence: 85,
    attentionScore: 900, occurredAt: new Date("2026-07-20T12:00:00Z"), ...overrides };
}

describe("Executive Platform view components", () => {
  it("renders score and confidence separately and never renders a missing score as zero", () => {
    const health: ExecutiveHealthSummary = { score: null, confidence: null, status: "unavailable", summary: "Health is unavailable.",
      availablePillars: 1, totalPillars: 7, supportingScoreKeys: ["revenue"] };
    const html = renderToStaticMarkup(createElement(PortfolioHealthOverview, { health, dataQuality }));
    expect(html).toContain("Health score");
    expect(html).toContain("Confidence");
    expect(html).toContain("Insufficient data");
    expect(html).toContain("1 of 7 HPM pillars");
    expect(html).toContain("Health is unavailable.");
    expect(html).not.toContain(">0<");
  });

  it("preserves attention order, separates categories, and renders only authoritative links", () => {
    const risk = item();
    const opportunity = item({ id: "attention-2", rank: 2, sourceId: "recommendation-2", title: "Improve occupancy", category: "occupancy", urgency: "medium" });
    const unsupported = item({ id: "attention-3", rank: 3, source: "intelligence", sourceId: "intelligence-1", title: "Market anomaly", category: "anomaly" });
    const html = renderToStaticMarkup(createElement(ExecutiveAttentionList, { attention: { risks: [risk], opportunities: [opportunity], priorities: [risk, opportunity, unsupported] } }));
    expect(html.indexOf("Protect revenue")).toBeLessThan(html.indexOf("Improve occupancy"));
    expect(html).toContain("Risks");
    expect(html).toContain("Opportunities");
    expect(html).toContain("Other priorities");
    expect(html.match(/href="\/dashboard\/insights"/g)).toHaveLength(2);
    expect(getExecutiveAttentionDestination(unsupported)).toBeUndefined();
    expect(getExecutiveAttentionDestination(item({ source: "action" }))).toBe("/dashboard/actions");
    expect(getExecutiveAttentionDestination(item({ category: "investment" }))).toBe("/dashboard/investments");
  });

  it("distinguishes unavailable lifecycle providers from authoritative empty counts", () => {
    const decisionHtml = renderToStaticMarkup(createElement(ExecutiveDecisionSection, { summary: { active: 0, awaitingEvidence: 0, readyForReview: 0, recentlyCompleted: 0, highestPriorityDecision: null }, dataQuality }));
    const executionHtml = renderToStaticMarkup(createElement(ExecutiveExecutionSection, { summary: { openActions: 0, inProgressActions: 0, overdueActions: 0, completedActions: 0, blockedActions: 0, highestPriorityAction: null }, dataQuality }));
    const outcomeHtml = renderToStaticMarkup(createElement(ExecutiveOutcomeSection, { summary: { measuredOutcomes: 0, positiveOutcomes: 0, neutralOutcomes: 0, negativeOutcomes: 0, latestOutcome: null, learningSummary: null }, dataQuality }));
    expect(decisionHtml).toContain("Decision data unavailable");
    expect(executionHtml).toContain("Execution data unavailable");
    expect(executionHtml).toContain("Open Action Center");
    expect(outcomeHtml).toContain("Outcome data unavailable");
  });

  it("renders concrete provider, scope, pillar, and confidence limitations", () => {
    const html = renderToStaticMarkup(createElement(ExecutiveDataQuality, { dataQuality }));
    expect(html).toContain("revenue");
    expect(html).toContain("operations");
    expect(html).toContain("Overall confidence: Unavailable");
    expect(html).toContain("Canonical scope is incomplete.");
  });
});

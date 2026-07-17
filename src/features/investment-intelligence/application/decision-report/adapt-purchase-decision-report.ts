import type {
  DecisionReport,
  PurchaseDecisionReport,
} from "../../domain";

export function adaptPurchaseDecisionReport(
  report: PurchaseDecisionReport,
): DecisionReport {
  return {
    strategy: "purchase",
    thesis: report.thesis,
    evidence: report.evidence.map(
      (evidence, index) => ({
        id: `${evidence.category}-${index + 1}`,
        category: evidence.category,
        label: evidence.label,
        finding: evidence.finding,
        value: evidence.value,
        direction: evidence.positive
          ? "positive"
          : "caution",
      }),
    ),
    risks: report.risks.map((risk) => ({
      id: risk.code,
      title: risk.title,
      severity: risk.severity,
      finding: risk.finding,
      impact: risk.impact,
      mitigation: risk.mitigation,
    })),
    opportunities: report.opportunities.map(
      (opportunity) => ({
        id: opportunity.code,
        title: opportunity.title,
        finding: opportunity.finding,
        expectedUpside:
          opportunity.expectedUpside,
        nextAction: opportunity.nextAction,
      }),
    ),
    confidence: report.confidence,
    recommendation: {
      value:
        report.recommendation
          .recommendation,
      headline:
        report.recommendation.headline,
      rationale:
        report.recommendation.rationale,
      conditions:
        report.recommendation.conditions,
      nextActions:
        report.recommendation.nextActions,
    },
  };
}

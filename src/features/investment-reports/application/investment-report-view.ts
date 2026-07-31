import type { InvestmentReportSnapshot, InvestmentReportStatus } from "../domain/investment-report";

export type InvestmentReportRecord = Readonly<{
  id: string; ownerId: string; opportunityId: string; analysisId: string; status: InvestmentReportStatus;
  title: string; strategy: "purchase" | "rental-arbitrage"; generatedAt: string; archivedAt: string | null;
  snapshot: InvestmentReportSnapshot;
}>;

export function buildInvestmentReportView(report: InvestmentReportRecord) {
  const snapshot = report.snapshot;
  return Object.freeze({
    ...report, recommendation: snapshot.decision.recommendation, recommendationSummary: snapshot.decision.summary,
    score: snapshot.score.value, scoreMaximum: snapshot.score.scaleMaximum,
    confidence: snapshot.confidence.level,
    completeness: snapshot.limitations.length === 0 ? "complete" as const : "limitations" as const,
    decisionReadiness: snapshot.limitations.length === 0 ? "Decision-ready" : "Decision-ready with limitations",
  });
}

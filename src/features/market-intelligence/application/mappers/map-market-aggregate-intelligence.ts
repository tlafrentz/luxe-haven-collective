import { IntelligenceBuilder, type IntelligenceReport, type TrendDirection as PlatformTrendDirection } from "@/platform/intelligence";
import type { Outcome } from "@/platform/outcomes";
import { ConfidenceAssessment, ConfidenceLevel, ConfidenceScore } from "@/platform/scoring";
import type { MarketIntelligenceAggregate } from "../../domain/entities/market-intelligence-aggregate";
import { TrendDirection } from "../../domain/enums/trend-direction";

/** Projects market-owned trend/opportunity methodology into canonical Intelligence artifacts. */
export function mapMarketAggregateIntelligence(aggregate: MarketIntelligenceAggregate, outcome: Outcome): IntelligenceReport {
  const confidence = ConfidenceAssessment.create({ score: ConfidenceScore.clamp(aggregate.confidence.overall.value), level: aggregate.confidence.overall.value >= 80 ? ConfidenceLevel.HIGH : ConfidenceLevel.MODERATE, rationale: ["Mapped from Market aggregate confidence dimensions."] });
  const previous = new Date(aggregate.generatedAt); previous.setUTCDate(previous.getUTCDate() - 1);
  const rationale = aggregate.trends.supportingSignals.length ? aggregate.trends.supportingSignals : [aggregate.trends.executiveSummary];
  return new IntelligenceBuilder().build({ result: {
    title: aggregate.executiveSummary.headline, summary: aggregate.executiveSummary.summary,
    reportingPeriod: { start: previous, end: aggregate.generatedAt }, confidence,
    insights: [{ title: "Market readiness", summary: aggregate.executiveSummary.summary, supportingOutcomes: [outcome], confidence, rationale: [aggregate.executiveSummary.summary], businessImpact: { marketScore: aggregate.overallMarketScore.value } }],
    trends: [{ title: "Market momentum", summary: aggregate.trends.executiveSummary, metric: "market-momentum", direction: direction(aggregate.trends.overallDirection), points: [{ at: previous, value: 50 }, { at: aggregate.generatedAt, value: aggregate.trends.momentumScore.value }], supportingOutcomes: [outcome], confidence, assumptions: ["The neutral baseline is represented as 50 for this projection."], rationale }],
    opportunities: aggregate.executiveSummary.opportunities.map((value) => ({ title: value, summary: value, supportingOutcomes: [outcome], confidence, rationale: [value], expectedImpact: { marketScore: aggregate.overallMarketScore.value } })),
    anomalies: [...aggregate.executiveSummary.risks, ...aggregate.executiveSummary.unknowns].map((value) => ({ title: "Market exception", summary: value, supportingOutcomes: [outcome], confidence, rationale: [value], expected: "market evidence within policy thresholds", actual: value, explanation: value })),
    forecasts: [{ title: "Market outlook", summary: aggregate.trends.executiveSummary, supportingOutcomes: [outcome], confidence, assumptions: ["Observed market signals remain materially consistent."], rationale, prediction: aggregate.trends.overallDirection, horizon: { start: aggregate.generatedAt, end: new Date(aggregate.generatedAt.getTime() + 31_536_000_000) } }],
    metadata: { marketName: aggregate.marketName, reportId: aggregate.reportId },
  } });
}

function direction(value: TrendDirection): PlatformTrendDirection {
  if (value === TrendDirection.Positive || value === TrendDirection.StronglyPositive) return "increasing";
  if (value === TrendDirection.Negative || value === TrendDirection.StronglyNegative) return "decreasing";
  return "stable";
}

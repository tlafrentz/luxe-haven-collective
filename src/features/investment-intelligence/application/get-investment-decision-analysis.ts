import type {
  InvestmentDecisionAnalysis,
  InvestmentDecisionRecommendation,
  InvestmentLifecycleResult,
} from "../domain";
import { AcquisitionRecommendation } from "../domain";
import { buildInvestmentWorkspaceView } from "./adapters";
import type { InvestmentWorkspaceAnalysisResult } from "./types";

type InvestmentDecisionAnalysisSource =
  Omit<InvestmentWorkspaceAnalysisResult, "decisionAnalysis">;

const COMPONENTS = [
  ["revenue", "Revenue potential", "revenuePotential", 25, "Projected ADR, occupancy, and comparable-supported revenue upside."],
  ["financial", "Financial strength", "financialStrength", 30, "Route-specific return, coverage, cash-flow, and break-even performance."],
  ["market", "Market strength", "marketStrength", 20, "Comparable occupancy and the confidence of current market evidence."],
  ["competitive", "Competitive position", "competitivePosition", 15, "The subject property's position relative to qualified comparables."],
  ["risk", "Risk resilience", "riskExposure", 10, "The inverse of identified financial and operating risk exposure."],
] as const;

/** Sole application query used to construct the PC-001A presentation model. */
export function getInvestmentDecisionAnalysis(
  source: InvestmentDecisionAnalysisSource,
  evaluatedAt: Date = source.investmentMarketContext.analyzedAt,
): InvestmentDecisionAnalysis {
  const lifecycleResult = source.lifecycleResult;
  const projection = lifecycleResult.analysis;
  const workspaceView = buildInvestmentWorkspaceView(lifecycleResult, {
    runId: source.lineage.workspaceRunId,
    observedAt: evaluatedAt,
    recordedAt: evaluatedAt,
  });
  const missing = source.investmentMarketContext.dataGaps.map((gap) =>
    `${gap.code}: ${gap.severity} market evidence gap`,
  );
  const hasBlockingGap = source.investmentMarketContext.dataGaps.some(
    ({ severity }) => severity === "blocking",
  );
  const hasMaterialGap = source.investmentMarketContext.dataGaps.some(
    ({ severity }) => severity === "material",
  );
  const stale = evaluatedAt.getTime() - source.investmentMarketContext.analyzedAt.getTime() > 24 * 60 * 60 * 1000;
  const recommendation = hasBlockingGap
    ? "insufficient-evidence"
    : mapRecommendation(projection.recommendation, projection.risks.some(({ severity }) => severity === "critical"));

  const analysis: InvestmentDecisionAnalysis = {
    identity: {
      workspaceRunId: source.lineage.workspaceRunId,
      subjectId: source.lineage.investmentSubjectId,
      propertyResolutionId: source.lineage.propertyResolutionId,
      marketAnalysisId: source.lineage.marketAnalysisId,
      acquisitionType: lifecycleResult.acquisitionType,
    },
    status: hasBlockingGap || stale ? "degraded" : hasMaterialGap || missing.length > 0 ? "partial" : "complete",
    recommendation: {
      status: recommendation,
      summary: recommendationSummary(recommendation),
      confidence: projection.confidence,
    },
    score: {
      overall: projection.score.overall.value,
      components: COMPONENTS.map(([key, label, field, weight, explanation]) => ({
        key,
        label,
        score: field === "riskExposure"
          ? 100 - projection.score[field].value
          : projection.score[field].value,
        weight,
        explanation,
      })),
    },
    evidence: {
      supportingCount: projection.supportingEvidence.length,
      marketEvidenceCount: source.investmentMarketContext.evidence.length,
      comparableCount: projection.comparableAnalysis.comparables.length,
      missing,
    },
    freshness: {
      status: stale ? "stale" : "current",
      evaluatedAt: new Date(evaluatedAt),
      marketAnalyzedAt: new Date(source.investmentMarketContext.analyzedAt),
    },
    timeline: buildTimeline(source, evaluatedAt),
    lineage: {
      marketEvidenceIds: [...source.lineage.marketEvidenceIds],
      platformEvidenceIds: workspaceView.platform.evidence.toArray().map(({ id }) => String(id)),
      recommendationIds: workspaceView.platform.recommendations.toArray().map(({ id }) => String(id)),
    },
    lifecycleResult,
    workspaceView,
  };
  return deepFreeze(analysis);
}

function mapRecommendation(
  value: InvestmentLifecycleResult["analysis"]["recommendation"],
  criticalRisk: boolean,
): InvestmentDecisionRecommendation {
  if (criticalRisk && value !== AcquisitionRecommendation.Pass) return "high-risk";
  switch (value) {
    case AcquisitionRecommendation.StrongBuy: return "strong-opportunity";
    case AcquisitionRecommendation.Buy: return "opportunity";
    case AcquisitionRecommendation.BuyWithConditions: return "proceed-with-conditions";
    case AcquisitionRecommendation.Wait: return "needs-investigation";
    case AcquisitionRecommendation.Pass: return "do-not-proceed";
  }
}

function recommendationSummary(status: InvestmentDecisionRecommendation): string {
  const summaries: Record<InvestmentDecisionRecommendation, string> = {
    "strong-opportunity": "The evidence and route-specific financial performance materially support this opportunity.",
    opportunity: "The opportunity is supported, with normal diligence still required before commitment.",
    "proceed-with-conditions": "The opportunity is supportable only if the identified conditions are validated.",
    "needs-investigation": "Material assumptions or evidence gaps require investigation before a decision.",
    "high-risk": "A critical risk materially limits the otherwise supported investment case.",
    "do-not-proceed": "The current evidence and financial performance do not support proceeding.",
    "insufficient-evidence": "The available evidence is not sufficient for a reliable acquisition recommendation.",
  };
  return summaries[status];
}

function buildTimeline(source: InvestmentDecisionAnalysisSource, evaluatedAt: Date) {
  const base = evaluatedAt.getTime();
  return [
    {
      id: `${source.lineage.workspaceRunId}:created`,
      type: "analysis-created" as const,
      title: "Analysis created",
      description: `${source.lifecycleResult.acquisitionType === "purchase" ? "Purchase" : "Rental Arbitrage"} assumptions were captured for the resolved property.`,
      occurredAt: new Date(base - 2),
    },
    {
      id: `${source.lineage.workspaceRunId}:evidence`,
      type: "evidence-evaluated" as const,
      title: "Market evidence evaluated",
      description: `${source.investmentMarketContext.evidence.length} market evidence items were evaluated through the bounded Market Intelligence projection.`,
      occurredAt: new Date(base - 1),
    },
    {
      id: `${source.lineage.workspaceRunId}:decision`,
      type: "decision-generated" as const,
      title: "Decision generated",
      description: "Financial performance, comparables, risks, score, confidence, and recommendation were generated together.",
      occurredAt: new Date(base),
    },
  ];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

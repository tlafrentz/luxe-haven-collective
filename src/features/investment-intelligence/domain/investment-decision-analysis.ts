import type { InvestmentLifecycleResult } from "./investment-lifecycle-result";
import type { InvestmentWorkspaceView } from "./investment-platform-artifacts";

export type InvestmentDecisionRecommendation =
  | "strong-opportunity"
  | "opportunity"
  | "proceed-with-conditions"
  | "needs-investigation"
  | "high-risk"
  | "do-not-proceed"
  | "insufficient-evidence";

export type InvestmentDecisionAnalysisStatus =
  | "complete"
  | "partial"
  | "degraded";

export type InvestmentScoreComponent = Readonly<{
  key:
    | "revenue"
    | "financial"
    | "market"
    | "competitive"
    | "risk";
  label: string;
  score: number;
  weight: number;
  explanation: string;
}>;

export type InvestmentDecisionTimelineEvent = Readonly<{
  id: string;
  type: "analysis-created" | "evidence-evaluated" | "decision-generated";
  title: string;
  description: string;
  occurredAt: Date;
}>;

/**
 * Canonical customer-facing projection for PC-001A.
 *
 * The lifecycle result remains embedded so route-specific Purchase and Rental
 * models stay intact. Everything surrounding it is bounded application
 * context; presentation must not reconstruct these facts.
 */
export type InvestmentDecisionAnalysis = Readonly<{
  identity: Readonly<{
    workspaceRunId: string;
    subjectId: string;
    propertyResolutionId: string;
    marketAnalysisId: string;
    acquisitionType: InvestmentLifecycleResult["acquisitionType"];
  }>;
  status: InvestmentDecisionAnalysisStatus;
  recommendation: Readonly<{
    status: InvestmentDecisionRecommendation;
    summary: string;
    confidence: InvestmentLifecycleResult["analysis"]["confidence"];
  }>;
  score: Readonly<{
    overall: number;
    components: readonly InvestmentScoreComponent[];
  }>;
  evidence: Readonly<{
    supportingCount: number;
    marketEvidenceCount: number;
    comparableCount: number;
    missing: readonly string[];
  }>;
  freshness: Readonly<{
    status: "current" | "stale";
    evaluatedAt: Date;
    marketAnalyzedAt: Date;
  }>;
  timeline: readonly InvestmentDecisionTimelineEvent[];
  lineage: Readonly<{
    marketEvidenceIds: readonly string[];
    platformEvidenceIds: readonly string[];
    recommendationIds: readonly string[];
  }>;
  lifecycleResult: InvestmentLifecycleResult;
  workspaceView: InvestmentWorkspaceView;
}>;

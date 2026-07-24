import type { PortfolioGoal, PortfolioId } from "@/features/portfolio";
import type { Identifier } from "@/platform/kernel";
import type { ConfidenceAssessment } from "@/platform/scoring";
import type { CapitalAllocationAssessment } from "../allocation";
import type { PortfolioHealthAssessment, PortfolioObservationWindow } from "../health";

export const PORTFOLIO_RECOMMENDATION_CATEGORIES = [
  "acquire", "improve", "preserve", "reduce-risk", "increase-liquidity",
  "diversify", "hold", "investigate", "monitor",
] as const;
export type PortfolioRecommendationCategory = typeof PORTFOLIO_RECOMMENDATION_CATEGORIES[number];

export const PORTFOLIO_RECOMMENDATION_TYPES = [
  "acquire-opportunity", "delay-acquisition", "increase-reserve", "renovate-property",
  "address-concentration", "resolve-capital-shortfall", "reduce-revenue-dependence",
  "improve-occupancy", "reevaluate-strategy", "collect-missing-data", "wait",
  "resolve-portfolio-risk", "monitor-portfolio-condition",
] as const;
export type PortfolioRecommendationType = typeof PORTFOLIO_RECOMMENDATION_TYPES[number];
export type PortfolioRecommendationPriority = "critical" | "high" | "medium" | "low" | "informational";
export type PortfolioRecommendationPosture = "grow" | "optimize" | "stabilize" | "protect" | "observe";
export type PortfolioRecommendationPolicyVersion = `portfolio-recommendations-${number}`;
export type PortfolioRecommendationId = Identifier<`portfolio-recommendation-${string}`>;

export type PortfolioRecommendationEvidenceKind =
  | "portfolio-health-finding"
  | "portfolio-health-gap"
  | "capital-allocation-finding"
  | "capital-allocation-constraint"
  | "capital-allocation-candidate"
  | "executive-observation"
  | "investment-observation"
  | "market-observation"
  | "portfolio-strategy";
export type PortfolioRecommendationEvidenceReference = Readonly<{
  kind: PortfolioRecommendationEvidenceKind;
  referenceId: string;
  sourceVersion?: string;
}>;
export type PortfolioRecommendationObservation = Readonly<{
  kind: "executive-observation" | "investment-observation" | "market-observation";
  observationId: string;
  code: string;
  subjectType: "portfolio" | "property" | "opportunity" | "market" | "capital" | "data";
  subjectId?: string;
  severity: "positive" | "informational" | "warning" | "high" | "critical";
  confidence: ConfidenceAssessment;
  observedAt: Date;
  sourceVersion?: string;
}>;
export type PortfolioRecommendationStrategy = Readonly<{
  available: boolean;
  defined: boolean;
  goals: readonly Readonly<{ kind: PortfolioGoal["kind"]; referenceId: string; priority: "low" | "normal" | "high" }>[];
  version: number;
}>;
export type PortfolioRecommendationBenefit =
  | "improves-liquidity" | "reduces-concentration" | "increases-noi" | "improves-health"
  | "supports-strategy" | "reduces-risk" | "improves-data-quality" | "preserves-capital";
export type PortfolioRecommendationTradeOff =
  | "reduces-liquidity" | "delays-growth" | "foregoes-opportunity" | "increases-concentration"
  | "requires-capital" | "requires-more-evidence" | "may-delay-strategy" | "operational-disruption";
export type PortfolioRecommendationConstraint =
  | "insufficient-capital" | "missing-strategy" | "incomplete-analysis" | "blocked-acquisition"
  | "stale-data" | "missing-data" | "mandatory-obligations-unfunded" | "policy-incompatible";
export type PortfolioRecommendationObjectReference = Readonly<{
  type: "portfolio" | "property" | "opportunity" | "market" | "capital";
  id: string;
}>;
export type PortfolioRecommendationImpact = Readonly<{
  health: "improve" | "maintain" | "unknown";
  capital: "improve" | "preserve" | "consume" | "unknown";
  risk: "reduce" | "maintain" | "unknown";
  strategy: "support" | "delay" | "unknown";
}>;
export type PortfolioRecommendedAction = Readonly<{
  code: PortfolioRecommendationType;
  subject: PortfolioRecommendationObjectReference;
  reversible: true;
}>;

export type PortfolioRecommendation = Readonly<{
  id: PortfolioRecommendationId;
  portfolioId: PortfolioId;
  category: PortfolioRecommendationCategory;
  type: PortfolioRecommendationType;
  priority: PortfolioRecommendationPriority;
  confidence: ConfidenceAssessment;
  evidence: readonly PortfolioRecommendationEvidenceReference[];
  benefits: readonly PortfolioRecommendationBenefit[];
  tradeOffs: readonly PortfolioRecommendationTradeOff[];
  constraints: readonly PortfolioRecommendationConstraint[];
  recommendedAction: PortfolioRecommendedAction;
  supportingFindingCodes: readonly string[];
  affectedObjects: readonly PortfolioRecommendationObjectReference[];
  estimatedImpact: PortfolioRecommendationImpact;
  rationaleCode: string;
  ignoredImpactCode: string;
  rank: number;
  conflictIds: readonly PortfolioRecommendationId[];
  policyVersion: PortfolioRecommendationPolicyVersion;
  generatedAt: Date;
}>;

export type PortfolioRecommendationAssessment = Readonly<{
  portfolioId: PortfolioId;
  portfolioVersion: number;
  healthPolicyVersion: string;
  allocationPolicyVersion: string;
  recommendationPolicyVersion: PortfolioRecommendationPolicyVersion;
  observationWindow: PortfolioObservationWindow;
  evaluatedAt: Date;
  posture: PortfolioRecommendationPosture;
  recommendations: readonly PortfolioRecommendation[];
  suppressed: readonly Readonly<{ normalizedKey: string; sourceCount: number }>[];
  conflicts: readonly Readonly<{ recommendationIds: readonly [PortfolioRecommendationId, PortfolioRecommendationId]; code: string }>[];
  confidence: ConfidenceAssessment;
  sourceLimitations: readonly string[];
  snapshotFingerprint: string;
}>;
export type EvaluatePortfolioRecommendationsInput = Readonly<{
  portfolioId: PortfolioId;
  portfolioVersion: number;
  health: PortfolioHealthAssessment;
  allocation: CapitalAllocationAssessment;
  strategy: PortfolioRecommendationStrategy;
  observations: readonly PortfolioRecommendationObservation[];
  policy: import("./policy").PortfolioRecommendationPolicy;
  observationWindow: PortfolioObservationWindow;
  evaluatedAt: Date;
  sourceLimitations?: readonly string[];
}>;

export type PortfolioRecommendationLifecycleStatus =
  | "generated" | "presented" | "acknowledged" | "resolved" | "dismissed"
  | "superseded" | "expired" | "historical";
export type PortfolioRecommendationLifecycleEvent = Readonly<{
  status: PortfolioRecommendationLifecycleStatus;
  occurredAt: Date;
  actorId?: string;
  reasonCode?: string;
}>;
export type PortfolioRecommendationHistory = Readonly<{
  recommendationId: PortfolioRecommendationId;
  portfolioId: PortfolioId;
  events: readonly PortfolioRecommendationLifecycleEvent[];
  currentStatus: PortfolioRecommendationLifecycleStatus;
}>;

export type PortfolioRecommendationChange = Readonly<{
  portfolioId: PortfolioId;
  comparable: boolean;
  newRecommendations: readonly PortfolioRecommendationId[];
  resolvedRecommendations: readonly PortfolioRecommendationId[];
  escalatedRecommendations: readonly PortfolioRecommendationId[];
  downgradedRecommendations: readonly PortfolioRecommendationId[];
  unchangedRecommendations: readonly PortfolioRecommendationId[];
  postureChange?: Readonly<{ from: PortfolioRecommendationPosture; to: PortfolioRecommendationPosture }>;
  reasonCode?: string;
}>;

import { Score, Weight } from "@/platform/scoring";

import { PORTFOLIO_HEALTH_DIMENSIONS, type PortfolioHealthBand, type PortfolioHealthDimension, type PortfolioHealthPolicyVersion } from "./contracts";

export type PortfolioHealthThresholds = Readonly<Record<PortfolioHealthBand, number>>;
export type PortfolioFreshnessPolicy = Readonly<{
  currentDays: number;
  agingDays: number;
  capitalCurrentDays: number;
  strategyCurrentDays: number;
}>;
export type PortfolioCoveragePolicy = Readonly<{
  minimumOverallPercentage: number;
  minimumDimensionPercentage: number;
}>;
export type PortfolioConcentrationPolicy = Readonly<{
  attentionTopShare: number;
  atRiskTopShare: number;
  criticalTopShare: number;
  singlePropertyScore: number;
}>;
export type PortfolioConfidencePolicy = Readonly<{
  freshnessWeight: Weight;
  coverageWeight: Weight;
  provenanceWeight: Weight;
  compatibilityWeight: Weight;
  fallbackPenaltyPoints: number;
}>;
export type PortfolioCriticalCondition =
  | "negative-aggregate-noi"
  | "capital-overcommitted"
  | "critical-active-risk"
  | "confidence-below-minimum";
export type PortfolioCriticalOverridePolicy = Readonly<{
  code: string;
  condition: PortfolioCriticalCondition;
  maximumBand: PortfolioHealthBand;
  maximumScore?: Score;
}>;
export type PortfolioHealthPolicy = Readonly<{
  version: PortfolioHealthPolicyVersion;
  dimensionWeights: Readonly<Record<PortfolioHealthDimension, Weight>>;
  thresholds: PortfolioHealthThresholds;
  freshness: PortfolioFreshnessPolicy;
  coverage: PortfolioCoveragePolicy;
  concentration: PortfolioConcentrationPolicy;
  confidence: PortfolioConfidencePolicy;
  criticalOverrides: readonly PortfolioCriticalOverridePolicy[];
  attentionPriorityLimit: number;
  contributionLimit: number;
  findingLimit: number;
  dataGapLimit: number;
  concentrationExposureLimit: number;
}>;

export function createPortfolioHealthPolicy(input: PortfolioHealthPolicy): PortfolioHealthPolicy {
  if (!/^portfolio-health-\d+$/.test(input.version)) throw new TypeError("Portfolio health policy version is invalid.");
  const keys = Object.keys(input.dimensionWeights).sort();
  if (keys.join("|") !== [...PORTFOLIO_HEALTH_DIMENSIONS].sort().join("|")) {
    throw new RangeError("Portfolio health policy must define every canonical dimension exactly once.");
  }
  const weightTotal = PORTFOLIO_HEALTH_DIMENSIONS.reduce((sum, dimension) => sum + input.dimensionWeights[dimension].ratio, 0);
  if (Math.abs(weightTotal - 1) > 1e-10) throw new RangeError("Portfolio health dimension weights must total 100%.");
  const { healthy, stable, attention, "at-risk": atRisk, critical } = input.thresholds;
  if (![healthy, stable, attention, atRisk, critical].every(Number.isFinite) || !(healthy > stable && stable > attention && attention > atRisk && atRisk >= critical)) {
    throw new RangeError("Portfolio health thresholds must be ordered from healthy to critical.");
  }
  if (input.freshness.currentDays < 0 || input.freshness.agingDays <= input.freshness.currentDays || input.freshness.capitalCurrentDays < 0 || input.freshness.strategyCurrentDays < 0) {
    throw new RangeError("Portfolio freshness thresholds are invalid.");
  }
  if (input.coverage.minimumOverallPercentage < 0 || input.coverage.minimumOverallPercentage > 100 || input.coverage.minimumDimensionPercentage < 0 || input.coverage.minimumDimensionPercentage > 100) {
    throw new RangeError("Portfolio coverage thresholds must be percentages.");
  }
  if ([input.attentionPriorityLimit, input.contributionLimit, input.findingLimit, input.dataGapLimit, input.concentrationExposureLimit].some((value) => !Number.isInteger(value) || value < 1)) {
    throw new RangeError("Portfolio health collection limits must be positive integers.");
  }
  return Object.freeze({
    ...input,
    dimensionWeights: Object.freeze({ ...input.dimensionWeights }),
    thresholds: Object.freeze({ ...input.thresholds }),
    freshness: Object.freeze({ ...input.freshness }),
    coverage: Object.freeze({ ...input.coverage }),
    concentration: Object.freeze({ ...input.concentration }),
    confidence: Object.freeze({ ...input.confidence }),
    criticalOverrides: Object.freeze(input.criticalOverrides.map((value) => Object.freeze({ ...value }))),
  });
}

export const PORTFOLIO_HEALTH_POLICY_V1 = createPortfolioHealthPolicy({
  version: "portfolio-health-1",
  dimensionWeights: {
    performance: Weight.fromPercentage(25),
    capital: Weight.fromPercentage(20),
    diversification: Weight.fromPercentage(15),
    resilience: Weight.fromPercentage(15),
    risk: Weight.fromPercentage(10),
    "strategic-alignment": Weight.fromPercentage(10),
    "data-quality": Weight.fromPercentage(5),
  },
  thresholds: { healthy: 85, stable: 70, attention: 50, "at-risk": 30, critical: 0 },
  freshness: { currentDays: 30, agingDays: 90, capitalCurrentDays: 7, strategyCurrentDays: 365 },
  coverage: { minimumOverallPercentage: 50, minimumDimensionPercentage: 40 },
  concentration: { attentionTopShare: 50, atRiskTopShare: 70, criticalTopShare: 90, singlePropertyScore: 35 },
  confidence: {
    coverageWeight: Weight.fromPercentage(40),
    freshnessWeight: Weight.fromPercentage(25),
    provenanceWeight: Weight.fromPercentage(20),
    compatibilityWeight: Weight.fromPercentage(15),
    fallbackPenaltyPoints: 10,
  },
  criticalOverrides: [
    { code: "NEGATIVE_AGGREGATE_NOI", condition: "negative-aggregate-noi", maximumBand: "at-risk", maximumScore: Score.create(49) },
    { code: "CAPITAL_OVERCOMMITTED", condition: "capital-overcommitted", maximumBand: "critical", maximumScore: Score.create(29) },
    { code: "CRITICAL_ACTIVE_RISK", condition: "critical-active-risk", maximumBand: "at-risk", maximumScore: Score.create(49) },
    { code: "CONFIDENCE_BELOW_MINIMUM", condition: "confidence-below-minimum", maximumBand: "attention", maximumScore: Score.create(69) },
  ],
  attentionPriorityLimit: 5,
  contributionLimit: 5,
  findingLimit: 100,
  dataGapLimit: 100,
  concentrationExposureLimit: 100,
});

export function bandForScore(score: number, policy: PortfolioHealthPolicy): PortfolioHealthBand {
  if (score >= policy.thresholds.healthy) return "healthy";
  if (score >= policy.thresholds.stable) return "stable";
  if (score >= policy.thresholds.attention) return "attention";
  if (score >= policy.thresholds["at-risk"]) return "at-risk";
  return "critical";
}

import type { PortfolioId, PortfolioOpportunityStatus } from "@/features/portfolio";
import type { Money, Percentage } from "@/platform/kernel";
import type { ObservationId } from "@/platform/observations";
import type { ConfidenceAssessment, Score, ScoreBreakdown, Weight } from "@/platform/scoring";

export const PORTFOLIO_HEALTH_DIMENSIONS = [
  "performance",
  "capital",
  "diversification",
  "resilience",
  "risk",
  "strategic-alignment",
  "data-quality",
] as const;
export type PortfolioHealthDimension = typeof PORTFOLIO_HEALTH_DIMENSIONS[number];
export type PortfolioHealthBand = "healthy" | "stable" | "attention" | "at-risk" | "critical";
export type PortfolioHealthPolicyVersion = `portfolio-health-${number}`;
export type PortfolioRiskLevel = "low" | "moderate" | "high" | "critical";
export type PortfolioObservationFreshness = "current" | "aging" | "stale" | "unknown";
export type PortfolioHealthSummaryCode =
  | "PORTFOLIO_HEALTH_STRONG"
  | "PORTFOLIO_HEALTH_SOUND"
  | "PORTFOLIO_HEALTH_REQUIRES_ATTENTION"
  | "PORTFOLIO_HEALTH_MATERIALLY_AT_RISK"
  | "PORTFOLIO_HEALTH_CRITICAL";
export type PortfolioHealthFindingCode =
  | "PORTFOLIO_REVENUE_CONCENTRATED"
  | "PORTFOLIO_MARKET_CONCENTRATED"
  | "PORTFOLIO_CAPITAL_OVERCOMMITTED"
  | "PORTFOLIO_CAPITAL_RESERVE_LOW"
  | "PORTFOLIO_NOI_NEGATIVE"
  | "PORTFOLIO_MARGIN_WEAK"
  | "PORTFOLIO_SINGLE_PROPERTY_DEPENDENCY"
  | "PORTFOLIO_MULTIPLE_UNDERPERFORMERS"
  | "PORTFOLIO_STRATEGY_MISALIGNED"
  | "PORTFOLIO_STRATEGY_ALIGNED"
  | "PORTFOLIO_DATA_COVERAGE_LOW"
  | "PORTFOLIO_DATA_STALE"
  | "PORTFOLIO_RISK_CRITICAL"
  | "PORTFOLIO_RISK_MANAGED"
  | "PORTFOLIO_REVENUE_DIVERSIFIED"
  | "PORTFOLIO_CAPITAL_RESILIENT"
  | "PORTFOLIO_PERFORMANCE_STRONG";
export type PortfolioHealthDataGapCode =
  | "PORTFOLIO_PERFORMANCE_MISSING"
  | "PORTFOLIO_PERFORMANCE_PERIOD_INCOMPATIBLE"
  | "PORTFOLIO_CURRENCY_INCOMPATIBLE"
  | "PORTFOLIO_CAPITAL_REQUIREMENT_UNKNOWN"
  | "PORTFOLIO_EXPOSURE_MISSING"
  | "PORTFOLIO_RISK_SOURCE_MISSING"
  | "PORTFOLIO_STRATEGY_MISSING"
  | "PORTFOLIO_STRATEGY_GOAL_UNSUPPORTED"
  | "PORTFOLIO_DATA_STALE"
  | "PORTFOLIO_PROPERTY_DATA_INCOMPLETE";

export type PortfolioObservationWindow = Readonly<{
  start: Date;
  end: Date;
  comparisonStart?: Date;
  comparisonEnd?: Date;
}>;

export type PortfolioMetricObservation = Readonly<{
  observationId: ObservationId;
  value: number;
  currency?: "USD" | string;
  numerator?: number;
  denominator?: number;
  window: PortfolioObservationWindow;
  confidence: ConfidenceAssessment;
  provenance: "verified" | "traceable" | "unverified";
  observedAt: Date;
}>;

export type PortfolioHealthPortfolioSource = Readonly<{
  portfolioId: PortfolioId;
  portfolioVersion: number;
  reportingCurrency: "USD";
  name: string;
}>;
export type PortfolioHealthPropertySource = Readonly<{
  propertyId: string;
  membershipStatus: "active" | "historical";
  marketKey?: string;
  geographicKey?: string;
  propertyType?: string;
  operatingModel?: string;
  capitalBasis?: Money;
  revenue?: PortfolioMetricObservation;
  netOperatingIncome?: PortfolioMetricObservation;
  occupancy?: PortfolioMetricObservation;
  adr?: PortfolioMetricObservation;
  revpar?: PortfolioMetricObservation;
  operatingMargin?: PortfolioMetricObservation;
  riskLevel?: PortfolioRiskLevel;
  dataCompleteness: Percentage;
  updatedAt: Date;
}>;
export type PortfolioHealthOpportunitySource = Readonly<{
  opportunityId: string;
  planningStatus: PortfolioOpportunityStatus;
  acquisitionRoute: "purchase" | "rental-arbitrage";
  committedCapital?: Money;
  expectedCapitalRequirement?: Money;
  marketKey?: string;
  propertyType?: string;
  riskLevel?: PortfolioRiskLevel;
  updatedAt: Date;
}>;
export type PortfolioHealthCapitalSource = Readonly<{
  available: Money;
  reserved: Money;
  committed: Money;
  allocated: Money;
  futureRequirements?: Money;
  capturedAt: Date;
}>;
export type PortfolioExposureSource = Readonly<{
  type: "property" | "market" | "geography" | "property-type" | "operating-model" | "revenue";
  key: string;
  share: Percentage;
  basis: "property-count" | "revenue" | "noi" | "capital";
  observationId?: ObservationId;
}>;
export type PortfolioHealthRiskSource = Readonly<{
  riskId: string;
  severity: PortfolioRiskLevel;
  status: "active" | "mitigated" | "resolved";
  subjectType: "portfolio" | "property" | "opportunity" | "capital";
  subjectId?: string;
  economicExposure?: Percentage;
  blocking: boolean;
  observedAt: Date;
  observationId?: ObservationId;
}>;
export type PortfolioHealthStrategyObjective = Readonly<{
  objectiveId: string;
  type: "maximum-market-concentration" | "maximum-property-revenue-share" | "minimum-liquidity-coverage" | "target-market" | "target-property-type" | "portfolio-size" | "custom";
  targetNumber?: number;
  targetKey?: string;
  priority: "low" | "normal" | "high";
}>;
export type PortfolioHealthStrategySource = Readonly<{
  strategyKind: string;
  objectives: readonly PortfolioHealthStrategyObjective[];
  updatedAt: Date;
}>;
export type PortfolioHealthObservationSource = Readonly<{
  observationId: ObservationId;
  type: string;
  subjectId: string;
  observedAt: Date;
  confidence: ConfidenceAssessment;
  provenance: "verified" | "traceable" | "unverified";
}>;
export type PortfolioHealthDataCoverageSource = Readonly<{
  expectedPropertyCount: number;
  coveredPropertyCount: number;
  expectedMetricCount: number;
  availableMetricCount: number;
  sourceAvailable: Readonly<Record<"performance" | "capital" | "exposure" | "risk" | "strategy", boolean>>;
}>;

export type PortfolioHealthSnapshot = Readonly<{
  portfolio: PortfolioHealthPortfolioSource;
  properties: readonly PortfolioHealthPropertySource[];
  opportunities: readonly PortfolioHealthOpportunitySource[];
  capital: PortfolioHealthCapitalSource;
  exposures: readonly PortfolioExposureSource[];
  risks: readonly PortfolioHealthRiskSource[];
  strategy: PortfolioHealthStrategySource | null;
  observations: readonly PortfolioHealthObservationSource[];
  dataCoverage: PortfolioHealthDataCoverageSource;
  capturedAt: Date;
}>;

export type PortfolioHealthObservationReference = Readonly<{
  observationId: ObservationId;
  role: "input" | "supporting" | "limiting";
}>;
export type PortfolioHealthEvidenceReference = Readonly<{
  kind: "observation" | "property" | "risk" | "objective" | "calculation";
  referenceId: string;
}>;
export type PortfolioHealthFindingValue = Readonly<{ value: number; unit: "score" | "percentage" | "money-usd" | "count" }>;
export type PortfolioHealthFinding = Readonly<{
  code: PortfolioHealthFindingCode;
  dimension: PortfolioHealthDimension;
  severity: "positive" | "informational" | "warning" | "high" | "critical";
  subject: "portfolio" | "property" | "market" | "capital" | "opportunity" | "data";
  subjectId?: string;
  evidence: readonly PortfolioHealthEvidenceReference[];
  value?: PortfolioHealthFindingValue;
  threshold?: PortfolioHealthFindingValue;
  resolvable: boolean;
}>;
export type PortfolioHealthFindingReference = Readonly<{
  code: PortfolioHealthFindingCode;
  subjectId?: string;
}>;
export type PortfolioHealthDataGap = Readonly<{
  code: PortfolioHealthDataGapCode;
  dimension: PortfolioHealthDimension;
  subjectType: "portfolio" | "property" | "opportunity" | "capital" | "strategy" | "observation";
  subjectId?: string;
  impact: "minor" | "material" | "blocking";
  missingFields: readonly string[];
  confidencePenalty: Percentage;
}>;
export type PortfolioConfidencePenalty = Readonly<{
  code: string;
  points: number;
  dimension?: PortfolioHealthDimension;
}>;
export type PortfolioHealthConfidence = Readonly<{
  assessment: ConfidenceAssessment;
  coverage: Percentage;
  freshness: Percentage;
  provenance: Percentage;
  compatibility: Percentage;
  penalties: readonly PortfolioConfidencePenalty[];
}>;
export type PortfolioHealthDimensionAssessment = Readonly<{
  dimension: PortfolioHealthDimension;
  score: Score;
  band: PortfolioHealthBand;
  weight: Weight;
  weightedContribution: number;
  confidence: ConfidenceAssessment;
  observations: readonly PortfolioHealthObservationReference[];
  findings: readonly PortfolioHealthFinding[];
  dataGaps: readonly PortfolioHealthDataGap[];
}>;
export type PortfolioHealthDimensionResult =
  | Readonly<{ status: "evaluated"; assessment: PortfolioHealthDimensionAssessment }>
  | Readonly<{ status: "insufficient-data"; dimension: PortfolioHealthDimension; confidence: ConfidenceAssessment; dataGaps: readonly PortfolioHealthDataGap[] }>
  | Readonly<{ status: "not-applicable"; dimension: PortfolioHealthDimension; reasonCode: string }>;

export type PortfolioOverallHealth = Readonly<{
  score: Score;
  band: PortfolioHealthBand;
  breakdown: ScoreBreakdown;
  limitingDimensions: readonly PortfolioHealthDimension[];
  summaryCode: PortfolioHealthSummaryCode;
}>;
export type PortfolioHealthAttentionPriority = Readonly<{
  rank: number;
  dimension: PortfolioHealthDimension;
  findingCode: PortfolioHealthFindingCode;
  severity: "warning" | "high" | "critical";
  subjectType: string;
  subjectId?: string;
  evidence: readonly PortfolioHealthEvidenceReference[];
}>;
export type PortfolioPropertyContribution = Readonly<{
  propertyId: string;
  revenueShare?: Percentage;
  noiShare?: Percentage;
  capitalShare?: Percentage;
  contribution: "positive" | "neutral" | "negative" | "unknown";
  healthDrivers: readonly PortfolioHealthFindingReference[];
  dataQuality: ConfidenceAssessment;
}>;
export type PortfolioContributionSummary = Readonly<{
  topRevenueContributors: readonly PortfolioPropertyContribution[];
  topNoiContributors: readonly PortfolioPropertyContribution[];
  negativeContributors: readonly PortfolioPropertyContribution[];
  unknownContributors: readonly PortfolioPropertyContribution[];
  concentratedOnSingleProperty: boolean;
}>;
export type PortfolioCapitalHealthAssessment = Readonly<{
  available: Money;
  reserved: Money;
  committed: Money;
  allocated: Money;
  futureRequirements?: Money;
  utilization: Percentage | null;
  liquidityCoverage: Percentage | null;
  unfundedCommitment: Money;
  score: Score;
  band: PortfolioHealthBand;
  findings: readonly PortfolioHealthFinding[];
  dataGaps: readonly PortfolioHealthDataGap[];
}>;
export type PortfolioConcentrationExposure = PortfolioExposureSource;
export type PortfolioConcentrationAssessment = Readonly<{
  type: PortfolioExposureSource["type"];
  score: Score;
  band: PortfolioHealthBand;
  topExposure: PortfolioConcentrationExposure | null;
  exposures: readonly PortfolioConcentrationExposure[];
  topThreeShare: Percentage;
  concentrationIndex: number;
  findings: readonly PortfolioHealthFinding[];
}>;
export type PortfolioHealthAssessment = Readonly<{
  portfolioId: PortfolioId;
  portfolioVersion: number;
  policyVersion: PortfolioHealthPolicyVersion;
  evaluatedAt: Date;
  observationWindow: PortfolioObservationWindow;
  overall: PortfolioOverallHealth;
  dimensions: readonly PortfolioHealthDimensionAssessment[];
  dimensionResults: readonly PortfolioHealthDimensionResult[];
  confidence: ConfidenceAssessment;
  healthConfidence: PortfolioHealthConfidence;
  strengths: readonly PortfolioHealthFinding[];
  risks: readonly PortfolioHealthFinding[];
  warnings: readonly PortfolioHealthFinding[];
  dataGaps: readonly PortfolioHealthDataGap[];
  attentionPriorities: readonly PortfolioHealthAttentionPriority[];
  contributionSummary: PortfolioContributionSummary;
  capitalAssessment: PortfolioCapitalHealthAssessment;
  concentrationAssessments: readonly PortfolioConcentrationAssessment[];
  snapshotFingerprint: string;
}>;
export type PortfolioHealthEvaluationResult =
  | Readonly<{ status: "evaluated"; assessment: PortfolioHealthAssessment }>
  | Readonly<{ status: "insufficient-data"; reason: "PORTFOLIO_HAS_NO_ACTIVE_PROPERTIES" | "PORTFOLIO_HEALTH_COVERAGE_BELOW_MINIMUM"; dimensionResults: readonly PortfolioHealthDimensionResult[]; dataGaps: readonly PortfolioHealthDataGap[]; confidence: ConfidenceAssessment; context: "empty" | "formation-stage" | "operating" }>;

export type EvaluatePortfolioHealthInput = Readonly<{
  snapshot: PortfolioHealthSnapshot;
  policy: import("./policy").PortfolioHealthPolicy;
  observationWindow: PortfolioObservationWindow;
  evaluatedAt: Date;
}>;

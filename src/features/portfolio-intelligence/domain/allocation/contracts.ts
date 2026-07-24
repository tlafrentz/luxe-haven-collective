import type { PortfolioGoal, PortfolioId, PortfolioOpportunityStatus } from "@/features/portfolio";
import type { Identifier, Money, Percentage } from "@/platform/kernel";
import type { ConfidenceAssessment, Score, Weight } from "@/platform/scoring";

import type { PortfolioHealthAssessment, PortfolioHealthDimension, PortfolioHealthFindingReference, PortfolioHealthPolicyVersion, PortfolioRiskLevel } from "../health";

export type CapitalAllocationCandidateId = Identifier<`capital-candidate-${string}`>;
export type CapitalAllocationPolicyVersion = `capital-allocation-${number}`;
export type CapitalAllocationSourceVersion = Readonly<{ source: string; version: number | string; updatedAt: Date }>;
export type CapitalAllocationPurpose =
  | "mandatory-obligation" | "liquidity-reserve" | "risk-remediation" | "property-improvement"
  | "property-expansion" | "new-acquisition" | "acquisition-closing" | "strategic-reserve" | "defer-deployment";
export type CapitalAllocationClassification = "mandatory" | "protective" | "growth" | "strategic" | "hold";
export type CapitalAllocationPriorityClass = "required" | "protect" | "improve" | "grow" | "reserve" | "defer";
export const CAPITAL_ALLOCATION_DIMENSIONS = [
  "portfolio-health-impact", "financial-efficiency", "strategic-alignment", "risk-adjustment",
  "diversification-impact", "liquidity-impact", "timing",
] as const;
export type CapitalAllocationDimension = typeof CAPITAL_ALLOCATION_DIMENSIONS[number];

export type CapitalAllocationSubject =
  | Readonly<{ type: "portfolio"; portfolioId: PortfolioId }>
  | Readonly<{ type: "property"; propertyId: string }>
  | Readonly<{ type: "opportunity"; opportunityId: string }>
  | Readonly<{ type: "acquisition"; opportunityId: string; pipelineId: string }>
  | Readonly<{ type: "obligation"; obligationId: string }>;
export type CapitalRequirementStage = Readonly<{ id: string; amount: Money; dueAt?: Date }>;
export type CapitalRequirement =
  | Readonly<{
      status: "known"; amount: Money; minimumAmount?: Money; maximumAmount?: Money;
      fundingType: "one-time" | "staged" | "reserve" | "recurring"; committed: boolean;
      reversible: boolean; estimated: boolean; dueAt?: Date; stages?: readonly CapitalRequirementStage[];
    }>
  | Readonly<{ status: "unknown"; fundingType: "one-time" | "staged" | "reserve" | "recurring"; committed: boolean; reasonCode: string }>;
export type CapitalAllocationTiming = Readonly<{
  urgency: "immediate" | "near-term" | "planned" | "optional";
  earliestDate?: Date; requiredBy?: Date; expirationDate?: Date;
  delayImpact: "none" | "minor" | "material" | "critical" | "unknown";
}>;
export type CapitalAllocationFinancialImpact = Readonly<{
  requiredCapital: Money; projectedAnnualCashFlow?: Money; projectedAnnualNoi?: Money;
  projectedReturn?: Percentage; projectedPaybackMonths?: number;
  valueBasis: "investment-analysis" | "property-improvement-estimate" | "committed-obligation" | "risk-avoidance" | "not-quantified";
  confidence: ConfidenceAssessment;
}>;
export type PortfolioHealthDimensionImpact = Readonly<{ dimension: PortfolioHealthDimension; direction: "improve" | "maintain" | "weaken" | "unknown" }>;
export type CapitalAllocationHealthImpact = Readonly<{
  affectedDimensions: readonly PortfolioHealthDimensionImpact[];
  expectedDirection: "improve" | "maintain" | "weaken" | "mixed" | "unknown";
  addressesLimitingDimension: boolean; addressesCriticalFinding: boolean;
  evidence: readonly PortfolioHealthFindingReference[];
}>;
export type PortfolioGoalReference = Readonly<{ kind: PortfolioGoal["kind"]; description: string }>;
export type CapitalAllocationStrategyImpact = Readonly<{
  status: "aligned" | "partially-aligned" | "misaligned" | "unevaluable";
  alignedGoals: readonly PortfolioGoalReference[]; conflictingGoals: readonly PortfolioGoalReference[];
  confidence: ConfidenceAssessment;
}>;
export type PortfolioExposureType = "property" | "market" | "geography" | "property-type" | "operating-model" | "revenue";
export type PortfolioExposureReference = Readonly<{ type: PortfolioExposureType; key: string }>;
export type CapitalAllocationDiversificationImpact = Readonly<{
  direction: "improves" | "neutral" | "worsens" | "unknown";
  affectedExposureTypes: readonly PortfolioExposureType[];
  addressesExistingConcentration: boolean; introducesNewConcentration: boolean;
  evidence: readonly PortfolioExposureReference[];
}>;
export type PortfolioRiskReference = Readonly<{ riskId: string; severity: PortfolioRiskLevel }>;
export type CapitalAllocationRisk = Readonly<{ code: string; severity: PortfolioRiskLevel; probability?: Percentage; evidenceReference?: string }>;
export type CapitalAllocationRiskImpact = Readonly<{
  direction: "reduces" | "neutral" | "increases" | "mixed" | "unknown";
  risksResolved: readonly PortfolioRiskReference[]; risksIntroduced: readonly CapitalAllocationRisk[];
  residualRisk: PortfolioRiskLevel | "unknown";
}>;
export type CapitalAllocationOperationalImpact = Readonly<{ direction: "positive" | "neutral" | "negative" | "unknown"; evidence: readonly string[] }>;
export type CapitalAllocationExpectedImpact = Readonly<{
  financial: CapitalAllocationFinancialImpact | null; health: CapitalAllocationHealthImpact;
  strategy: CapitalAllocationStrategyImpact; diversification: CapitalAllocationDiversificationImpact;
  risk: CapitalAllocationRiskImpact; operations: CapitalAllocationOperationalImpact | null;
}>;
export type CapitalAllocationEvidenceReference = Readonly<{ kind: "health-finding" | "analysis" | "property" | "obligation" | "risk" | "strategy" | "calculation"; referenceId: string }>;
export type CapitalAllocationCandidate = Readonly<{
  id: CapitalAllocationCandidateId; portfolioId: PortfolioId; purpose: CapitalAllocationPurpose;
  classification: CapitalAllocationClassification; subject: CapitalAllocationSubject;
  requiredCapital: CapitalRequirement; timing: CapitalAllocationTiming;
  expectedImpact: CapitalAllocationExpectedImpact; risks: readonly CapitalAllocationRisk[];
  evidence: readonly CapitalAllocationEvidenceReference[]; confidence: ConfidenceAssessment;
  sourceVersion: CapitalAllocationSourceVersion;
}>;
export type CapitalAllocationCandidateReference = Readonly<{
  id: CapitalAllocationCandidateId;
  purpose: CapitalAllocationPurpose;
  classification: CapitalAllocationClassification;
  subject: CapitalAllocationSubject;
  requiredCapital: CapitalRequirement;
  timing: CapitalAllocationTiming;
  expectedImpact: CapitalAllocationExpectedImpact;
}>;

export type CapitalAllocationPosition = Readonly<{
  reportingCurrency: "USD"; availableCapital: Money; reservedCapital: Money; committedCapital: Money;
  allocatedCapital: Money; requiredMinimumReserve: Money; nearTermObligations: Money;
  unverifiedCapital?: Money; capturedAt: Date;
}>;
export type CapitalAllocationPositionSummary = Readonly<{
  availableCapital: Money; deployableCapital: Money; requiredMinimumReserve: Money;
  committedCapital: Money; nearTermObligations: Money; capitalShortfall: Money;
}>;
export type CapitalAllocationCondition = Readonly<{ code: string; evidence: readonly CapitalAllocationEvidenceReference[] }>;
export type CapitalAllocationBlockerCode =
  | "ALLOCATION_CAPITAL_INSUFFICIENT" | "ALLOCATION_RESERVE_BREACH" | "ALLOCATION_COMMITMENT_UNFUNDED"
  | "ALLOCATION_CURRENCY_INCOMPATIBLE" | "ALLOCATION_REQUIREMENT_UNKNOWN" | "ALLOCATION_SOURCE_STALE"
  | "ALLOCATION_OPPORTUNITY_INELIGIBLE" | "ALLOCATION_ACQUISITION_TERMINAL" | "ALLOCATION_DUPLICATE_COMMITMENT"
  | "ALLOCATION_CANDIDATE_EXPIRED";
export type CapitalAllocationBlocker = Readonly<{ code: CapitalAllocationBlockerCode; evidence: readonly CapitalAllocationEvidenceReference[] }>;
export type CapitalAllocationDataGapCode =
  | "ALLOCATION_REQUIREMENT_UNKNOWN" | "ALLOCATION_STRATEGY_UNAVAILABLE" | "ALLOCATION_FINANCIAL_IMPACT_UNKNOWN"
  | "ALLOCATION_EXPOSURE_IMPACT_UNKNOWN" | "ALLOCATION_SOURCE_UNAVAILABLE" | "ALLOCATION_SOURCE_STALE"
  | "ALLOCATION_CANDIDATE_COVERAGE_LOW";
export type CapitalAllocationDataGap = Readonly<{
  code: CapitalAllocationDataGapCode; candidateId?: CapitalAllocationCandidateId;
  source: "portfolio" | "capital" | "health" | "property" | "opportunity" | "acquisition" | "strategy";
  impact: "minor" | "material" | "blocking"; missingFields: readonly string[]; confidencePenalty: Percentage;
}>;
export type CapitalAllocationFeasibility =
  | Readonly<{ status: "feasible"; capitalRequired: Money; deployableCapitalBefore: Money; deployableCapitalAfter: Money; reserveCoverageAfter: Percentage | null; conditions: readonly CapitalAllocationCondition[] }>
  | Readonly<{ status: "conditionally-feasible"; capitalRequired: Money; conditions: readonly CapitalAllocationCondition[]; blockers: readonly CapitalAllocationBlocker[] }>
  | Readonly<{ status: "infeasible"; blockers: readonly CapitalAllocationBlocker[] }>
  | Readonly<{ status: "insufficient-data"; dataGaps: readonly CapitalAllocationDataGap[] }>;
export type MandatoryCapitalObligationAssessment = Readonly<{ candidateId: CapitalAllocationCandidateId; amount: Money | null; funded: Money; unfunded: Money; urgency: CapitalAllocationTiming["urgency"] }>;
export type MandatoryCapitalCoverage = Readonly<{ totalRequired: Money; funded: Money; unfunded: Money; coverage: Percentage | null; obligations: readonly MandatoryCapitalObligationAssessment[] }>;

export type CapitalAllocationFinding = Readonly<{
  code: string; severity: "positive" | "informational" | "warning" | "high" | "critical";
  evidence: readonly CapitalAllocationEvidenceReference[]; value?: number;
}>;
export type CapitalAllocationEffect = Readonly<{ code: string; direction: "positive" | "negative"; magnitude: "minor" | "material" | "critical" | "unknown" }>;
export type CapitalAllocationTradeOff = Readonly<{
  code: string; type: "liquidity" | "growth" | "risk" | "diversification" | "performance" | "strategy" | "timing";
  positiveEffect?: CapitalAllocationEffect; negativeEffect?: CapitalAllocationEffect;
  evidence: readonly CapitalAllocationEvidenceReference[];
}>;
export type CapitalAllocationOpportunityCost = Readonly<{
  candidateId: CapitalAllocationCandidateId;
  type: "expired-opportunity" | "delayed-growth" | "unresolved-risk" | "foregone-return" | "strategy-delay" | "unknown";
  severity: "minor" | "moderate" | "material" | "critical";
  evidence: readonly CapitalAllocationEvidenceReference[];
}>;
export type CapitalAllocationScoreComponent = Readonly<{
  dimension: CapitalAllocationDimension; score: Score; weight: Weight; contribution: number;
  evidence: readonly CapitalAllocationEvidenceReference[]; confidence: ConfidenceAssessment;
  dataGaps: readonly CapitalAllocationDataGap[];
}>;
export type CapitalAllocationScoreBreakdown = Readonly<{ total: Score; components: readonly CapitalAllocationScoreComponent[]; policyVersion: CapitalAllocationPolicyVersion }>;
export type CapitalAllocationCandidateAssessment = Readonly<{
  candidate: CapitalAllocationCandidateReference; feasibility: CapitalAllocationFeasibility;
  priorityClass: CapitalAllocationPriorityClass; scores: CapitalAllocationScoreBreakdown | null;
  confidence: ConfidenceAssessment; strengths: readonly CapitalAllocationFinding[];
  weaknesses: readonly CapitalAllocationFinding[]; tradeOffs: readonly CapitalAllocationTradeOff[];
  opportunityCosts: readonly CapitalAllocationOpportunityCost[];
  dataGaps: readonly CapitalAllocationDataGap[]; rank: number | null;
  posture: "fund" | "fund-conditionally" | "defer" | "reject" | "required" | "insufficient-data";
}>;
export type CapitalAllocationPortfolioPosture =
  | "fund-mandatory-obligations" | "preserve-liquidity" | "remediate-portfolio-risk"
  | "improve-existing-assets" | "pursue-growth" | "allocate-selectively" | "defer-deployment" | "insufficient-data";
export type CapitalAllocationConstraint = Readonly<{ code: string; severity: "warning" | "critical"; candidateId?: CapitalAllocationCandidateId }>;
export type CapitalAllocationConfidencePenalty = Readonly<{ code: string; points: number; candidateId?: CapitalAllocationCandidateId }>;
export type CapitalAllocationConfidence = Readonly<{
  assessment: ConfidenceAssessment; portfolioHealth: ConfidenceAssessment; capital: ConfidenceAssessment;
  candidateCoverage: Percentage; sourceFreshness: Percentage; penalties: readonly CapitalAllocationConfidencePenalty[];
}>;
export type CapitalAllocationAssessment = Readonly<{
  portfolioId: PortfolioId; portfolioVersion: number; portfolioHealthAssessmentId?: string;
  healthPolicyVersion: PortfolioHealthPolicyVersion; allocationPolicyVersion: CapitalAllocationPolicyVersion;
  evaluatedAt: Date; capitalPosition: CapitalAllocationPositionSummary; mandatoryCoverage: MandatoryCapitalCoverage;
  candidates: readonly CapitalAllocationCandidateAssessment[]; recommendedPosture: CapitalAllocationPortfolioPosture;
  primaryCandidateId?: CapitalAllocationCandidateId; alternateCandidateIds: readonly CapitalAllocationCandidateId[];
  constraints: readonly CapitalAllocationConstraint[]; portfolioTradeOffs: readonly CapitalAllocationTradeOff[];
  dataGaps: readonly CapitalAllocationDataGap[]; confidence: ConfidenceAssessment;
  allocationConfidence: CapitalAllocationConfidence; snapshotFingerprint: string;
}>;
export type CapitalAllocationPortfolioSource = Readonly<{ portfolioId: PortfolioId; portfolioVersion: number; reportingCurrency: "USD"; goals: readonly PortfolioGoalReference[] }>;
export type EvaluateCapitalAllocationInput = Readonly<{
  portfolio: CapitalAllocationPortfolioSource; health: PortfolioHealthAssessment; capital: CapitalAllocationPosition;
  candidates: readonly CapitalAllocationCandidate[]; policy: import("./policy").CapitalAllocationPolicy; evaluatedAt: Date;
  portfolioHealthAssessmentId?: string; sourceDataGaps?: readonly CapitalAllocationDataGap[];
}>;

export type CapitalAllocationAcquisitionSource = Readonly<{
  opportunityId: string; opportunityVersion: number; analysisId: string; analysisVersion: number;
  recommendation: string; requiredCapital: Money | null; projectedAnnualCashFlow?: Money; projectedNoi?: Money;
  projectedReturn?: Percentage; acquisitionStatus: PortfolioOpportunityStatus; pipelineStage?: string;
  committed: boolean; marketExposure?: PortfolioExposureReference; propertyTypeExposure?: PortfolioExposureReference;
  riskLevel?: PortfolioRiskLevel; confidence: ConfidenceAssessment; updatedAt: Date; acquisitionRoute: "purchase" | "rental-arbitrage";
}>;
export type CapitalAllocationPropertyImprovementSource = Readonly<{
  propertyId: string; improvementId: string; category: "revenue" | "operations" | "guest-experience" | "compliance" | "risk" | "capital-maintenance";
  requiredCapital: Money | null; expectedFinancialImpact?: CapitalAllocationFinancialImpact;
  expectedHealthImpact: CapitalAllocationHealthImpact; urgency: CapitalAllocationTiming;
  confidence: ConfidenceAssessment; updatedAt: Date;
}>;
export type CapitalAllocationObligationSource = Readonly<{
  obligationId: string; subject: CapitalAllocationSubject; type: "acquisition-closing" | "contractual" | "regulatory" | "critical-maintenance" | "risk-remediation" | "other";
  amount: Money | null; requiredBy?: Date; committed: boolean; severity: "normal" | "high" | "critical"; confidence: ConfidenceAssessment;
}>;

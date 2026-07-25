import type { PortfolioFindings, PortfolioFinding, FindingEvidence } from "../findings";
import type { ConfidenceLevel } from "@/platform/scoring";
import type { WorkspaceRole } from "@/features/workspace";

export type CapitalAllocationCategory =
  | "revenue-improvement" | "property-improvement" | "operational-improvement"
  | "guest-experience" | "risk-reduction" | "technology" | "operating-reserve"
  | "maintenance" | "debt-reduction" | "new-acquisition" | "market-expansion"
  | "data-improvement";
export type ResourceType =
  | "cash" | "operating-expense" | "capital-expense" | "team-capacity"
  | "management-attention" | "technology-capacity" | "external-partner-capacity";
export type ResourceCadence = "one-time" | "recurring" | "internal";
export type AllocationCandidateStatus =
  | "draft" | "ready-for-review" | "under-review" | "approved" | "rejected"
  | "deferred" | "superseded" | "expired";
export type RecommendationStrength =
  | "strong-recommendation" | "recommendation" | "consider" | "monitor"
  | "insufficient-evidence";
export type PortfolioDecisionType =
  | "allocate-capital" | "hold-property" | "optimize-property" | "invest-in-property"
  | "reposition-property" | "monitor-property" | "review-exit" | "acquire-property"
  | "enter-market" | "reduce-concentration" | "accept-risk" | "mitigate-risk"
  | "change-operating-model" | "defer-initiative";
export type DecisionHorizon = "immediate" | "near-term" | "quarterly" | "annual" | "multi-year";
export type EffortEstimate = "low" | "moderate" | "high" | "transformational";
export type Reversibility = "easily-reversible" | "partially-reversible" | "difficult-to-reverse" | "irreversible";
export type AssumptionStatus = "confirmed" | "unconfirmed" | "invalidated" | "expired";
export type DependencyStatus = "resolved" | "unresolved" | "accepted";
export type PortfolioDecisionStatus =
  | "draft" | "ready-for-review" | "under-review" | "approved" | "rejected"
  | "deferred" | "superseded" | "completed" | "expired";
export type DecisionCommandType =
  | "start-review" | "approve" | "reject" | "defer" | "request-evidence" | "supersede";

export type Money = Readonly<{ amount: number; currency: string }>;
export type ResourceRequirement = Readonly<{
  type: ResourceType;
  cadence: ResourceCadence;
  amount?: Money;
  hours?: number;
  description: string;
  estimated: boolean;
  confidence: ConfidenceLevel;
}>;
export type ExpectedImpactDimension = Readonly<{
  dimension: "revenue" | "noi" | "cash-flow" | "margin" | "occupancy" | "adr"
    | "revpar" | "operational-efficiency" | "guest-experience" | "risk-reduction"
    | "portfolio-diversification" | "data-quality";
  value: Readonly<{ type: "range"; minimum: number; maximum: number; unit: string }
    | { type: "point"; value: number; unit: string }
    | { type: "directional"; direction: "increase" | "decrease" | "maintain" }
    | { type: "unavailable"; reason: string }>;
  expected: true;
}>;
export type ExpectedImpact = Readonly<{
  dimensions: readonly ExpectedImpactDimension[];
  timeToImpact?: Readonly<{ minimumDays: number; maximumDays: number }>;
  measurementPeriod?: Readonly<{ minimumDays: number; maximumDays: number }>;
  basis: Readonly<{
    type: "historical-performance" | "comparable-properties" | "market-benchmark"
      | "scenario-model" | "operator-assumption" | "vendor-estimate"
      | "existing-intelligence-recommendation";
    description: string;
  }>;
}>;
export type DecisionAssumption = Readonly<{
  id: string; statement: string; status: AssumptionStatus; material: boolean;
  expiresAt?: string;
}>;
export type DecisionDependency = Readonly<{
  id: string;
  type: "property-configuration" | "provider-data" | "operational-capacity"
    | "vendor-availability" | "financing" | "regulatory-approval" | "market-evidence"
    | "team-availability" | "prior-decision" | "external-contract";
  description: string; status: DependencyStatus; critical: boolean;
}>;
export type AlternativeRisk = Readonly<{ title: string; description: string }>;
export type StrategicAlternative = Readonly<{
  id: string; label: string; description: string; baseline: boolean;
  requiredResources: readonly ResourceRequirement[]; expectedImpact: ExpectedImpact;
  risks: readonly AlternativeRisk[]; confidence: ConfidenceLevel;
  reversibility: Reversibility; tradeoffs: readonly string[];
}>;
export type CapitalReturn = Readonly<{
  expectedRoi: Readonly<{ minimum: number; maximum: number }> | null;
  paybackMonths: Readonly<{ minimum: number; maximum: number }> | null;
  unavailableReason?: string;
}>;
export type PortfolioDecisionCandidate = Readonly<{
  id: string; workspaceId: string; sourceFindingIds: readonly string[];
  affectedPropertyIds: readonly string[]; category: CapitalAllocationCategory;
  decisionType: PortfolioDecisionType; title: string; description: string;
  requestedResources: readonly ResourceRequirement[]; expectedImpact: ExpectedImpact;
  riskReduction?: ExpectedImpactDimension; effort: EffortEstimate; horizon: DecisionHorizon;
  confidence: ConfidenceLevel; assumptions: readonly DecisionAssumption[];
  dependencies: readonly DecisionDependency[]; alternatives: readonly StrategicAlternative[];
  recommendedAlternativeId?: string; recommendationStrength: RecommendationStrength;
  capitalReturn: CapitalReturn; status: AllocationCandidateStatus;
  ordering: Readonly<{ materiality: string; urgency: string; confidence: ConfidenceLevel;
    riskReduction: boolean; dependencyReadiness: string; timeToImpact: string;
    rationale: readonly string[] }>;
  evidenceVersion: string; generatedAt: string; expiresAt: string;
}>;
export type CapitalConflict = Readonly<{
  id: string; type: "budget" | "resource" | "strategic" | "timing" | "dependency" | "property";
  candidateIds: readonly string[]; description: string; blocking: boolean;
}>;
export type ExpectedOutcome = Readonly<{
  metric: string; baseline?: Readonly<{ value: number; unit: string }>;
  target?: Readonly<{ minimum: number; maximum: number; unit: string }>;
  direction?: "increase" | "decrease" | "maintain";
  measurementWindow: Readonly<{ minimumDays: number; maximumDays: number }>;
  confidence: ConfidenceLevel; evidence: readonly FindingEvidence[];
}>;
export type DecisionActivity = Readonly<{
  id: string; operation: string; actorProfileId: string; occurredAt: string; safeSummary: string;
}>;
export type PortfolioStrategicDecision = Readonly<{
  decisionId: string; canonicalDecisionId?: string; workspaceId: string;
  decisionType: PortfolioDecisionType; question: string; sourceFindingIds: readonly string[];
  affectedPropertyIds: readonly string[];
  recommendationId?: string; alternatives: readonly StrategicAlternative[];
  recommendedAlternativeId?: string; selectedAlternativeId?: string; rationale: string;
  evidence: readonly FindingEvidence[]; evidenceVersion: string; confidence: ConfidenceLevel;
  assumptions: readonly DecisionAssumption[]; dependencies: readonly DecisionDependency[];
  expectedOutcomes: readonly ExpectedOutcome[]; approvedResources: readonly ResourceRequirement[];
  status: PortfolioDecisionStatus; ownerProfileId: string; decidedByProfileId?: string;
  reviewAt?: string; decidedAt?: string; revision: number; createdAt: string; updatedAt: string;
  activity: readonly DecisionActivity[];
}>;
export type DecisionExecutionPlan = Readonly<{
  decisionId: string;
  actions: readonly Readonly<{ id: string; title: string; type: string; decisionId: string; sourceFindingIds: readonly string[] }>[];
  editable: true;
}>;
export type DecisionMeasurementPlan = Readonly<{
  decisionId: string; outcomes: readonly ExpectedOutcome[]; ownerProfileId: string; reviewAt: string;
}>;
export type PortfolioDecisionSummary = Readonly<{
  proposedCapital: Money | null; approvedCapital: Money | null; committedCapital: Money | null;
  spentCapital: Money | null; recommendationsReady: number; activeDecisions: number;
  reviewsDue: number;
}>;
export type PortfolioDecisionWorkspace = Readonly<{
  findings: PortfolioFindings; candidates: readonly PortfolioDecisionCandidate[];
  conflicts: readonly CapitalConflict[]; decisions: readonly PortfolioStrategicDecision[];
  summary: PortfolioDecisionSummary;
  state: "ready" | "empty" | "insufficient-evidence" | "degraded" | "permission-limited";
  canApprove: boolean; role: WorkspaceRole; evaluatedAt: string;
}>;
export type DecisionPolicy = Readonly<{
  version: string; minimumConfidence: ConfidenceLevel; recommendationValidityDays: number;
  staleApprovalBlocked: boolean; ownerOnlyCapitalApproval: boolean; defaultReviewDays: number;
}>;
export type DecisionRepository = Readonly<{
  list(workspaceId: string): Promise<readonly PortfolioStrategicDecision[]>;
  get(workspaceId: string, decisionId: string): Promise<PortfolioStrategicDecision | null>;
  save(decision: PortfolioStrategicDecision, expectedRevision: number, commandId: string): Promise<PortfolioStrategicDecision>;
}>;
export type DecisionCommand = Readonly<{
  commandId: string; type: DecisionCommandType; expectedRevision: number;
  actorProfileId: string; actorRole: WorkspaceRole; occurredAt: string;
  selectedAlternativeId?: string; rationale?: string; reviewAt?: string;
}>;
export type BuildCandidateInput = Readonly<{ finding: PortfolioFinding; workspaceId: string; now: string }>;

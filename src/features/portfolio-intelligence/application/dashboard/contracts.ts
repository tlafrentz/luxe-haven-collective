import type { PortfolioId } from "@/features/portfolio";
import type { ConfidenceAssessment } from "@/platform/scoring";
import type {
  CapitalAllocationAssessment,
  PortfolioHealthAssessment,
  PortfolioObservationWindow,
  PortfolioRecommendationAssessment,
  PortfolioRecommendationHistory,
} from "../../domain";
import type {
  PortfolioWorkspaceOpportunitySource,
  PortfolioWorkspacePropertySource,
  PortfolioWorkspaceSource,
} from "../workspace";

export const PORTFOLIO_DASHBOARD_LIMITS = Object.freeze({
  recommendations: 3,
  attention: 5,
  changes: 5,
  positiveDrivers: 3,
  constrainingDrivers: 3,
  exposures: 3,
  limitingDimensions: 3,
  subjectReferences: 24,
});

export type PortfolioDashboardSection = "health" | "capital" | "allocation" | "recommendations" | "changes" | "drivers" | "quality";
export type PortfolioDashboardCapabilityAvailability = Readonly<{ available: boolean; reasonCode?: string }>;
export type PortfolioDashboardSubjectReference = Readonly<{
  type: "portfolio" | "property" | "opportunity" | "market" | "capital";
  id: string;
  label: string;
  destination?: string;
}>;
export type PortfolioDashboardSourceReference = Readonly<{ type: string; referenceId: string }>;
export type PortfolioDashboardPortfolioSummary = Readonly<{
  id: string;
  name: string;
  activePropertyCount: number;
  activeOpportunityCount: number;
  reportingCurrency: "USD";
  updatedAt: Date;
  observationWindow: PortfolioObservationWindow;
  lifecycle: "empty" | "formation-stage" | "single-property" | "operating";
  workspaceDestination: string;
}>;
export type PortfolioDashboardConstraintSummary = Readonly<{
  code: string;
  dimension?: string;
  severity: string;
  subject?: PortfolioDashboardSubjectReference;
  destination: string;
}>;
export type PortfolioDashboardRecommendationReference = Readonly<{
  id: string;
  type: string;
  category: string;
  priority: string;
  subject: PortfolioDashboardSubjectReference;
  destination: string;
}>;
export type PortfolioDashboardExecutiveSummary = Readonly<{
  healthBand: string | null;
  healthScore?: number;
  healthDirection: "improved" | "stable" | "declined" | "not-comparable";
  primaryConstraint: PortfolioDashboardConstraintSummary | null;
  capitalStatus: "protected" | "constrained" | "overcommitted" | "unavailable";
  allocationPosture: string | null;
  topRecommendation: PortfolioDashboardRecommendationReference | null;
  confidence: ConfidenceAssessment | null;
  intelligenceStatus: "current" | "stale" | "incomplete";
}>;
export type PortfolioDashboardHealthMovement =
  | Readonly<{ status: "improved" | "declined"; scoreDelta?: number; bandChanged: boolean; keyDrivers: readonly string[] }>
  | Readonly<{ status: "stable"; scoreDelta?: number; keyDrivers: readonly string[] }>
  | Readonly<{ status: "not-comparable"; reason: "no-previous-assessment" | "policy-incompatible" | "window-incompatible" | "coverage-insufficient" }>;
export type PortfolioDashboardHealthSummary = Readonly<{
  status: "available" | "unavailable";
  band?: string;
  score?: number;
  confidence?: ConfidenceAssessment;
  movement: PortfolioDashboardHealthMovement;
  evaluatedAt?: Date;
  limitingDimensions: readonly Readonly<{ dimension: string; band: string | null; findingCode?: string; subject?: PortfolioDashboardSubjectReference; destination: string }>[];
  dimensions: readonly Readonly<{ dimension: string; status: "evaluated" | "insufficient-data" | "not-applicable"; band?: string; score?: number; confidence: string; findingCode?: string }>[];
  destination: string;
}>;
export type PortfolioDashboardCapitalSummary = Readonly<{
  status: "protected" | "constrained" | "overcommitted" | "unavailable";
  reportingCurrency: "USD";
  available: number | null;
  protected: number | null;
  committed: number | null;
  nearTermObligations: number | null;
  deployable: number | null;
  unfunded: number | null;
  reserveCoverage: number | null;
  mandatoryRequired: number | null;
  mandatoryFunded: number | null;
  mostUrgentObligation: Readonly<{ id: string; amount: number | null; urgency: string }> | null;
  confidence: ConfidenceAssessment | null;
  evaluatedAt?: Date;
  destination: string;
}>;
export type PortfolioDashboardAllocationSummary = Readonly<{
  status: "available" | "unavailable";
  posture: string | null;
  confidence: ConfidenceAssessment | null;
  primaryConstraint: string | null;
  primaryCandidate: Readonly<{
    id: string;
    purpose: string;
    subject: PortfolioDashboardSubjectReference;
    requiredCapital: number | null;
    feasibility: string;
    rank: number | null;
    healthDirection: string;
    liquidityAfter: number | null;
    strategicAlignment: string;
    primaryTradeOff: string | null;
  }> | null;
  evaluatedAt?: Date;
  destination: string;
}>;
export type PortfolioDashboardRecommendation = Readonly<{
  id: string;
  category: string;
  type: string;
  priority: string;
  rationaleCode: string;
  ignoredImpactCode: string;
  subject: PortfolioDashboardSubjectReference;
  primaryBenefit: string | null;
  primaryTradeOff: string | null;
  confidence: ConfidenceAssessment;
  lifecycleStatus: string;
  evidenceCount: number;
  conflictIds: readonly string[];
  destination: string;
}>;
export type PortfolioDashboardRecommendationSummary = Readonly<{
  status: "available" | "unavailable";
  posture: string | null;
  criticalCount: number;
  highCount: number;
  totalActiveCount: number;
  topRecommendations: readonly PortfolioDashboardRecommendation[];
  conflictingRecommendations: readonly Readonly<{ recommendationIds: readonly [string, string]; code: string; destination: string }>[];
  stale: boolean;
  evaluatedAt?: Date;
  destination: string;
}>;
export type PortfolioDashboardChange = Readonly<{
  id: string;
  type: "health" | "capital" | "allocation" | "recommendation" | "composition" | "data-quality";
  code: string;
  direction: "positive" | "negative" | "neutral";
  occurredAt?: Date;
  subject?: PortfolioDashboardSubjectReference;
  destination?: string;
}>;
export type PortfolioDashboardChangeSummary = Readonly<{
  comparable: boolean;
  noComparisonReason?: string;
  items: readonly PortfolioDashboardChange[];
}>;
export type PortfolioDashboardDriver = Readonly<{
  subject: PortfolioDashboardSubjectReference;
  contribution: "positive" | "constraining" | "capital-consuming";
  revenueShare?: number;
  noiShare?: number;
  capitalShare?: number;
  driverCode?: string;
  confidence: string;
  recommendationCount: number;
}>;
export type PortfolioDashboardExposureHighlight = Readonly<{
  type: string;
  key: string;
  share: number;
  basis: string;
  band: string;
  destination: string;
}>;
export type PortfolioDashboardDriverSummary = Readonly<{
  positive: readonly PortfolioDashboardDriver[];
  constraining: readonly PortfolioDashboardDriver[];
  capitalConsuming: readonly PortfolioDashboardDriver[];
  exposures: readonly PortfolioDashboardExposureHighlight[];
  singleProperty: boolean;
}>;
export type PortfolioDashboardAttentionItem = Readonly<{
  rank: number;
  type: "health" | "capital" | "allocation" | "recommendation" | "data";
  severity: "critical" | "high" | "medium" | "informational";
  code: string;
  subject?: PortfolioDashboardSubjectReference;
  sourceReference: PortfolioDashboardSourceReference;
  destination?: string;
}>;
export type PortfolioDashboardAttentionSummary = Readonly<{ items: readonly PortfolioDashboardAttentionItem[] }>;
export type PortfolioDashboardFreshnessSummary = Readonly<{
  overall: "current" | "stale" | "incomplete";
  confidence: ConfidenceAssessment | null;
  propertyCoverage: Readonly<{ covered: number; total: number }> | null;
  staleObservationCount: number;
  blockingGapCount: number;
  healthEvaluatedAt: Date | null;
  allocationEvaluatedAt: Date | null;
  recommendationEvaluatedAt: Date | null;
  healthStatus: "current" | "stale" | "unavailable";
  allocationStatus: "current" | "stale" | "incompatible" | "unavailable";
  recommendationStatus: "current" | "stale" | "incompatible" | "unavailable";
  lineage: Readonly<{ portfolioVersion: number; healthPolicyVersion: string | null; allocationPolicyVersion: string | null; recommendationPolicyVersion: string | null }>;
}>;
export type PortfolioDashboardCapabilities = Readonly<{
  viewPortfolio: PortfolioDashboardCapabilityAvailability;
  viewHealth: PortfolioDashboardCapabilityAvailability;
  viewAllocation: PortfolioDashboardCapabilityAvailability;
  viewRecommendations: PortfolioDashboardCapabilityAvailability;
  refreshIntelligence: PortfolioDashboardCapabilityAvailability;
  acknowledgeRecommendation: PortfolioDashboardCapabilityAvailability;
  deferRecommendation: PortfolioDashboardCapabilityAvailability;
  dismissRecommendation: PortfolioDashboardCapabilityAvailability;
  createAction: PortfolioDashboardCapabilityAvailability;
}>;
export type PortfolioDashboardLimitation = Readonly<{ code: string; section: PortfolioDashboardSection; impact: "minor" | "material" | "blocking"; guidanceCode: string }>;
export type PortfolioDashboardDataGap = Readonly<{ code: string; section: PortfolioDashboardSection; impact: "minor" | "material" | "blocking" }>;

export type PortfolioIntelligenceDashboard = Readonly<{
  portfolio: PortfolioDashboardPortfolioSummary;
  executiveSummary: PortfolioDashboardExecutiveSummary;
  health: PortfolioDashboardHealthSummary;
  capital: PortfolioDashboardCapitalSummary;
  allocation: PortfolioDashboardAllocationSummary;
  recommendations: PortfolioDashboardRecommendationSummary;
  changes: PortfolioDashboardChangeSummary;
  drivers: PortfolioDashboardDriverSummary;
  attention: PortfolioDashboardAttentionSummary;
  freshness: PortfolioDashboardFreshnessSummary;
  capabilities: PortfolioDashboardCapabilities;
  limitations: readonly PortfolioDashboardLimitation[];
}>;
export type PortfolioFormationDashboard = Readonly<{ portfolio: PortfolioDashboardPortfolioSummary; capital: PortfolioDashboardCapitalSummary; allocation: PortfolioDashboardAllocationSummary; recommendations: PortfolioDashboardRecommendationSummary; limitations: readonly PortfolioDashboardLimitation[] }>;
export type PortfolioEmptyDashboard = Readonly<{ portfolio: PortfolioDashboardPortfolioSummary; capital: PortfolioDashboardCapitalSummary; limitations: readonly PortfolioDashboardLimitation[] }>;
export type PortfolioIntelligenceDashboardState =
  | Readonly<{ status: "ready"; dashboard: PortfolioIntelligenceDashboard }>
  | Readonly<{ status: "formation-stage"; dashboard: PortfolioFormationDashboard }>
  | Readonly<{ status: "empty"; dashboard: PortfolioEmptyDashboard }>
  | Readonly<{ status: "degraded"; dashboard: PortfolioIntelligenceDashboard; unavailableSections: readonly PortfolioDashboardSection[] }>
  | Readonly<{ status: "insufficient-data"; portfolio: PortfolioDashboardPortfolioSummary; availableSections: readonly PortfolioDashboardSection[]; gaps: readonly PortfolioDashboardDataGap[] }>;

export type PortfolioDashboardSource = Readonly<{
  current: PortfolioWorkspaceSource;
  recommendations: PortfolioRecommendationAssessment | null;
  recommendationHistories: readonly PortfolioRecommendationHistory[];
  previousHealth: PortfolioHealthAssessment | null;
  previousAllocation: CapitalAllocationAssessment | null;
  previousRecommendations: PortfolioRecommendationAssessment | null;
}>;
export type GetPortfolioIntelligenceDashboardQuery = Readonly<{
  ownerId: string;
  portfolioId: PortfolioId;
  observationWindow: PortfolioObservationWindow;
  recommendationLimit?: number;
  driverLimit?: number;
  changeLimit?: number;
  attentionLimit?: number;
  evaluatedAt: Date;
}>;
export type GetPortfolioIntelligenceDashboardError =
  | Readonly<{ code: "PORTFOLIO_DASHBOARD_NOT_AUTHENTICATED" }>
  | Readonly<{ code: "PORTFOLIO_DASHBOARD_NOT_FOUND" }>
  | Readonly<{ code: "PORTFOLIO_DASHBOARD_INPUT_INVALID"; field?: string }>
  | Readonly<{ code: "PORTFOLIO_DASHBOARD_PORTFOLIO_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "PORTFOLIO_DASHBOARD_UNEXPECTED"; correlationId?: string }>;
export interface PortfolioDashboardAuthorizer {
  authorize(ownerId: string, portfolioId: PortfolioId): Promise<"authorized" | "unauthenticated" | "concealed">;
}
export interface PortfolioDashboardReader {
  read(ownerId: string, portfolioId: PortfolioId, referenceLimit: number): Promise<PortfolioDashboardSource | null>;
}
export interface PortfolioDashboardObserver {
  record(event: "portfolio_dashboard_opened", fields: Readonly<{ status: string; unavailableSectionCount: number }>): void;
}

export type PortfolioDashboardReferenceSource = Readonly<{
  properties: readonly PortfolioWorkspacePropertySource[];
  opportunities: readonly PortfolioWorkspaceOpportunitySource[];
}>;

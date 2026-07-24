import type { PortfolioId } from "@/features/portfolio";
import type { CapitalAllocationAssessment } from "../../domain/allocation";
import type {
  PortfolioHealthAssessment,
  PortfolioHealthBand,
  PortfolioHealthDimension,
  PortfolioObservationWindow,
} from "../../domain/health";

export const PORTFOLIO_WORKSPACE_LIMITS = Object.freeze({
  attention: 8,
  propertyContributions: 12,
  allocationCandidates: 8,
  findings: 6,
  exposures: 8,
});

export type PortfolioWorkspaceSection = "health" | "capital" | "allocation" | "composition" | "attention";
export type PortfolioWorkspaceFreshness = "current" | "stale" | "incompatible" | "unavailable";
export type PortfolioCapabilityAvailability = Readonly<{ available: boolean; reasonCode?: string }>;

export type PortfolioWorkspacePropertySource = Readonly<{
  propertyId: string;
  name: string;
  market?: string;
  propertyType?: string;
  operatingModel?: string;
  active: boolean;
}>;
export type PortfolioWorkspaceOpportunitySource = Readonly<{
  opportunityId: string;
  name: string;
  planningStatus: string;
  active: boolean;
}>;
export type PortfolioWorkspaceSource = Readonly<{
  portfolioId: PortfolioId;
  version: number;
  name: string;
  strategySummary?: string;
  reportingCurrency: "USD";
  updatedAt: Date;
  properties: readonly PortfolioWorkspacePropertySource[];
  opportunities: readonly PortfolioWorkspaceOpportunitySource[];
  health: PortfolioHealthAssessment | null;
  allocation: CapitalAllocationAssessment | null;
}>;

export type PortfolioWorkspaceSummary = Readonly<{
  id: string;
  name: string;
  strategySummary: string | null;
  activePropertyCount: number;
  activeOpportunityCount: number;
  reportingCurrency: "USD";
  updatedAt: Date;
  observationWindow: PortfolioObservationWindow | null;
}>;
export type PortfolioWorkspaceFinding = Readonly<{
  code: string;
  severity: string;
  subject: string;
  subjectId?: string;
}>;
export type PortfolioWorkspaceDataGap = Readonly<{
  code: string;
  section: PortfolioWorkspaceSection;
  impact: "minor" | "material" | "blocking";
  missingFields: readonly string[];
  confidenceReduced: boolean;
  rankingBlocked: boolean;
}>;
export type PortfolioHealthDimensionWorkspace = Readonly<{
  dimension: PortfolioHealthDimension;
  status: "evaluated" | "insufficient-data" | "not-applicable";
  band?: PortfolioHealthBand;
  score?: number;
  confidence: string;
  weightedContribution?: number;
  positiveFinding?: PortfolioWorkspaceFinding;
  limitingFinding?: PortfolioWorkspaceFinding;
  reasonCode?: string;
  gaps: readonly PortfolioWorkspaceDataGap[];
}>;
export type PortfolioHealthWorkspaceState = Readonly<{
  status: "available";
  band: PortfolioHealthBand;
  score: number;
  confidence: string;
  summaryCode: string;
  limitingDimensions: readonly PortfolioHealthDimension[];
  dimensions: readonly PortfolioHealthDimensionWorkspace[];
  strengths: readonly PortfolioWorkspaceFinding[];
  risks: readonly PortfolioWorkspaceFinding[];
  warnings: readonly PortfolioWorkspaceFinding[];
  dataGaps: readonly PortfolioWorkspaceDataGap[];
  evaluatedAt: Date;
  freshness: PortfolioWorkspaceFreshness;
}>;
export type PortfolioCapitalWorkspaceState = Readonly<{
  status: "available";
  reportingCurrency: "USD";
  available: number;
  reserved: number;
  committed: number;
  allocated: number;
  nearTermObligations: number;
  requiredReserve: number;
  deployable: number;
  unfunded: number;
  mandatoryRequired: number;
  mandatoryFunded: number;
  mandatoryCoverage: number | null;
  capitalStatus: "protected" | "constrained" | "overcommitted";
}>;
export type PortfolioAllocationCandidateWorkspace = Readonly<{
  id: string;
  purpose: string;
  subjectType: string;
  subjectId: string;
  requiredCapital: number | null;
  feasibility: string;
  rank: number | null;
  posture: string;
  confidence: string;
  healthDirection: string;
  strategicAlignment: string;
  diversificationDirection: string;
  liquidityAfter: number | null;
  strengths: readonly string[];
  weaknesses: readonly string[];
  tradeOffs: readonly string[];
  blockers: readonly string[];
  isPreserveCapital: boolean;
}>;
export type PortfolioAllocationWorkspaceState = Readonly<{
  status: "available";
  posture: string;
  confidence: string;
  evaluatedAt: Date;
  freshness: PortfolioWorkspaceFreshness;
  primary: PortfolioAllocationCandidateWorkspace | null;
  alternates: readonly PortfolioAllocationCandidateWorkspace[];
  infeasible: readonly PortfolioAllocationCandidateWorkspace[];
  constraints: readonly string[];
  tradeOffs: readonly string[];
  dataGaps: readonly PortfolioWorkspaceDataGap[];
}>;
export type PortfolioCompositionWorkspaceSummary = Readonly<{
  activeProperties: number;
  activeOpportunities: number;
  lifecycle: "empty" | "formation-stage" | "single-property" | "operating";
  markets: readonly Readonly<{ key: string; propertyCount: number }>[];
  propertyTypes: readonly Readonly<{ key: string; propertyCount: number }>[];
  opportunityStates: readonly Readonly<{ key: string; count: number }>[];
  exposures: readonly Readonly<{
    type: string;
    basis: string;
    band: string;
    topExposure: Readonly<{ key: string; share: number }> | null;
    topThreeShare: number;
    confidence: string;
  }>[];
  propertyContributions: readonly Readonly<{
    propertyId: string;
    name: string;
    market: string | null;
    revenueShare?: number;
    noiShare?: number;
    capitalShare?: number;
    contribution: string;
    confidence: string;
    primaryDriver?: string;
  }>[];
}>;
export type PortfolioAttentionWorkspaceSummary = Readonly<{
  priorities: readonly Readonly<{
    rank: number;
    dimension: PortfolioHealthDimension;
    severity: string;
    findingCode: string;
    subjectType: string;
    subjectId?: string;
  }>[];
}>;
export type PortfolioAssessmentLineageSummary = Readonly<{
  portfolioVersion: number;
  healthPolicyVersion: string | null;
  allocationPolicyVersion: string | null;
  healthEvaluatedAt: Date | null;
  allocationEvaluatedAt: Date | null;
  observationWindow: PortfolioObservationWindow | null;
  healthFreshness: PortfolioWorkspaceFreshness;
  allocationFreshness: PortfolioWorkspaceFreshness;
  compatible: boolean;
}>;
export type PortfolioWorkspaceCapabilities = Readonly<{
  viewHealth: PortfolioCapabilityAvailability;
  evaluateHealth: PortfolioCapabilityAvailability;
  viewAllocation: PortfolioCapabilityAvailability;
  evaluateAllocation: PortfolioCapabilityAvailability;
  editPortfolio: PortfolioCapabilityAvailability;
  editCapital: PortfolioCapabilityAvailability;
  editStrategy: PortfolioCapabilityAvailability;
  executeAllocation: PortfolioCapabilityAvailability;
}>;
export type PortfolioWorkspaceLimitation = Readonly<{
  code: string;
  section: PortfolioWorkspaceSection;
  impact: "minor" | "material" | "blocking";
  guidance: string;
}>;

export type PortfolioIntelligenceWorkspace = Readonly<{
  portfolio: PortfolioWorkspaceSummary;
  health: PortfolioHealthWorkspaceState | null;
  capital: PortfolioCapitalWorkspaceState | null;
  allocation: PortfolioAllocationWorkspaceState | null;
  composition: PortfolioCompositionWorkspaceSummary;
  attention: PortfolioAttentionWorkspaceSummary;
  assessmentLineage: PortfolioAssessmentLineageSummary;
  capabilities: PortfolioWorkspaceCapabilities;
  limitations: readonly PortfolioWorkspaceLimitation[];
}>;
export type PortfolioFormationWorkspaceSummary = Readonly<{
  activeOpportunities: number;
  capital: PortfolioCapitalWorkspaceState | null;
  allocation: PortfolioAllocationWorkspaceState | null;
  limitations: readonly PortfolioWorkspaceLimitation[];
}>;
export type PortfolioIntelligenceWorkspaceState =
  | Readonly<{ status: "ready"; workspace: PortfolioIntelligenceWorkspace }>
  | Readonly<{ status: "health-unavailable"; portfolio: PortfolioWorkspaceSummary; capital?: PortfolioCapitalWorkspaceState; limitations: readonly PortfolioWorkspaceLimitation[] }>
  | Readonly<{ status: "allocation-unavailable"; portfolio: PortfolioWorkspaceSummary; health: PortfolioHealthWorkspaceState; capital?: PortfolioCapitalWorkspaceState; limitations: readonly PortfolioWorkspaceLimitation[] }>
  | Readonly<{ status: "insufficient-data"; portfolio: PortfolioWorkspaceSummary; gaps: readonly PortfolioWorkspaceDataGap[]; availableSections: readonly PortfolioWorkspaceSection[] }>
  | Readonly<{ status: "formation-stage"; portfolio: PortfolioWorkspaceSummary; formation: PortfolioFormationWorkspaceSummary }>;

export type GetPortfolioIntelligenceWorkspaceQuery = Readonly<{
  ownerId: string;
  portfolioId: PortfolioId;
  observationWindow: PortfolioObservationWindow;
  attentionLimit?: number;
  propertyContributionLimit?: number;
  allocationCandidateLimit?: number;
  evaluatedAt: Date;
}>;
export type GetPortfolioIntelligenceWorkspaceError =
  | Readonly<{ code: "PORTFOLIO_WORKSPACE_NOT_AUTHENTICATED" }>
  | Readonly<{ code: "PORTFOLIO_WORKSPACE_NOT_FOUND" }>
  | Readonly<{ code: "PORTFOLIO_WORKSPACE_NOT_AUTHORIZED" }>
  | Readonly<{ code: "PORTFOLIO_WORKSPACE_INPUT_INVALID"; field?: string }>
  | Readonly<{ code: "PORTFOLIO_WORKSPACE_PORTFOLIO_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "PORTFOLIO_WORKSPACE_UNEXPECTED"; correlationId?: string }>;

export interface PortfolioWorkspaceAuthorizer {
  authorize(ownerId: string, portfolioId: PortfolioId): Promise<"authorized" | "unauthenticated" | "concealed">;
}
export interface PortfolioWorkspaceReader {
  read(ownerId: string, portfolioId: PortfolioId): Promise<PortfolioWorkspaceSource | null>;
}
export interface PortfolioWorkspaceObserver {
  record(event: "portfolio_workspace_opened", fields: Readonly<{ status: string; limitationCount: number }>): void;
}

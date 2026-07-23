import type {
  InvestmentOpportunityId,
  InvestmentOpportunityRoute,
  OpportunityAnalysisId,
  OpportunityStatus,
} from "../../domain";
import type {
  AcceptedAgreementBasis,
  AcquisitionActivity,
  AcquisitionActorReference,
  AcquisitionClosingFacts,
  AcquisitionClosingReadiness,
  AcquisitionContract,
  AcquisitionExit,
  AcquisitionOffer,
  AcquisitionStage,
  AcquisitionStageCategory,
  AcquisitionStageHistoryEntry,
  AcquisitionContingency,
  CounterpartyResponse,
  DueDiligenceItem,
} from "../../acquisition-pipeline/domain";

export const ACQUISITION_WORKSPACE_LIMITS = Object.freeze({
  activityDefault: 12,
  activityMaximum: 50,
  historyDefault: 10,
  historyMaximum: 30,
  priorOffersDefault: 3,
  priorOffersMaximum: 10,
  requirementsDefault: 8,
  requirementsMaximum: 25,
  blockersMaximum: 10,
  warningsMaximum: 10,
});

export type GetAcquisitionWorkspaceQuery = Readonly<{
  ownerId: string;
  actor: AcquisitionActorReference;
  opportunityId: InvestmentOpportunityId;
  activityLimit?: number;
  historyLimit?: number;
  offerHistoryLimit?: number;
  requirementsLimit?: number;
}>;

export type AcquisitionWorkspaceResolvedLimits = Readonly<{
  activity: number;
  history: number;
  priorOffers: number;
  requirements: number;
  blockers: number;
  warnings: number;
}>;

export type AcquisitionWorkspaceMoney = Readonly<{ amount: number; currency: "USD" }>;
export type AcquisitionWorkspaceLocation = Readonly<{
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  display: string;
}>;
export type AcquisitionWorkspaceHeadlineValue =
  | Readonly<{ type: "purchase-price"; amount: AcquisitionWorkspaceMoney }>
  | Readonly<{ type: "monthly-rent"; amount: AcquisitionWorkspaceMoney }>
  | Readonly<{ type: "target-value"; amount: AcquisitionWorkspaceMoney }>;

export type InvestmentOpportunityWorkspaceSummary = Readonly<{
  id: string;
  name: string;
  location: AcquisitionWorkspaceLocation;
  route: InvestmentOpportunityRoute;
  status: OpportunityStatus;
  archived: boolean;
  tags: readonly string[];
  createdAt: Date;
  updatedAt: Date;
  headlineValue?: AcquisitionWorkspaceHeadlineValue;
}>;

export type InvestmentAnalysisAge = Readonly<{ days: number; classification: "current" | "aging" | "stale" }>;
export type InvestmentAnalysisWorkspaceSummary = Readonly<{
  analysisId: string;
  version: number;
  analyzedAt: Date;
  route: InvestmentOpportunityRoute;
  recommendation: "strong-buy" | "buy" | "buy-with-conditions" | "wait" | "pass";
  score?: number;
  confidence?: Readonly<{ level: string; explanation?: string }>;
  assumptionFingerprint?: string;
  age: InvestmentAnalysisAge;
  stale: boolean;
  historicalAnalysisHref: string;
}>;

export type AcquisitionActivationBlockerCode =
  | "ANALYSIS_REQUIRED"
  | "ANALYSIS_INCOMPLETE"
  | "ANALYSIS_ROUTE_MISMATCH"
  | "OPPORTUNITY_ARCHIVED"
  | "OPPORTUNITY_ALREADY_ACQUIRED"
  | "UNSUPPORTED_ACQUISITION_ROUTE"
  | "NOT_AUTHORIZED"
  | "INFRASTRUCTURE_NOT_VERIFIED";
export type AcquisitionWorkspaceBlocker = Readonly<{ code: string; message: string; sourceId?: string }>;
export type AcquisitionActivationSummary = Readonly<{
  eligible: boolean;
  sourceAnalysisId?: string;
  sourceAnalysisVersion?: number;
  blockers: readonly Readonly<{ code: AcquisitionActivationBlockerCode; message: string }>[];
  limitations: readonly AcquisitionCapabilityLimitation[];
}>;

export type AcquisitionWorkspaceActorSummary = Readonly<{ type: "user" | "system"; id: string }>;
export type AcquisitionLifecycleStageSummary = Readonly<{
  stage: AcquisitionStage;
  label: string;
  state: "completed" | "current" | "upcoming" | "exited" | "unreachable";
  completedAt?: Date;
}>;
export type AcquisitionAvailableTransitionSummary = Readonly<{
  targetStage: AcquisitionStage;
  label: string;
  allowed: boolean;
  commandType: "ordinary-transition" | "submit-offer" | "record-counter" | "record-acceptance" | "record-contract" | "begin-due-diligence" | "begin-closing-preparation" | "close-acquisition" | "exit-pipeline";
  blockers: readonly AcquisitionWorkspaceBlocker[];
}>;
export type AcquisitionStageHistoryWorkspaceEntry = Readonly<{
  id: string;
  from?: AcquisitionStage;
  to: AcquisitionStage;
  occurredAt: Date;
  classification: "forward" | "backward" | "terminal";
}>;
export type AcquisitionLifecycleWorkspaceSummary = Readonly<{
  currentStage: AcquisitionStage;
  currentStageIndex: number;
  stages: readonly AcquisitionLifecycleStageSummary[];
  availableTransitions: readonly AcquisitionAvailableTransitionSummary[];
  recentHistory: readonly AcquisitionStageHistoryWorkspaceEntry[];
  historyTotalCount: number;
  historyTruncated: boolean;
}>;

export type AcquisitionAnalysisReferenceWorkspaceSummary = Readonly<{
  analysisId: string;
  version: number;
  analyzedAt: Date;
  assumptionFingerprint?: string;
}>;
export type AcquisitionOfferHeadlineTerms =
  | Readonly<{ route: "purchase"; offerPrice: AcquisitionWorkspaceMoney; financingType: "cash" | "financed"; proposedClosingDate?: Date }>
  | Readonly<{ route: "rental-arbitrage"; proposedMonthlyRent: AcquisitionWorkspaceMoney; leaseTermMonths: number; proposedCommencementDate?: Date; operatingPermissionRequested: boolean }>;
export type AcquisitionContractHeadlineTerms =
  | Readonly<{ route: "purchase"; contractPrice: AcquisitionWorkspaceMoney; financingType: "cash" | "financed"; scheduledClosingDate: Date }>
  | Readonly<{ route: "rental-arbitrage"; monthlyRent: AcquisitionWorkspaceMoney; leaseTermMonths: number; commencementDate: Date; possessionDate?: Date }>;
export type AcquisitionOfferWorkspaceSummary = Readonly<{
  id: string;
  sequence: number;
  status: AcquisitionOffer["status"];
  route: InvestmentOpportunityRoute;
  createdAt: Date;
  submittedAt?: Date;
  expiresAt?: Date;
  sourceAnalysis: AcquisitionAnalysisReferenceWorkspaceSummary;
  headlineTerms: AcquisitionOfferHeadlineTerms;
  current: boolean;
  editable: boolean;
}>;
export type AcquisitionOfferHistoryWorkspaceSummary = Readonly<{
  id: string;
  sequence: number;
  status: AcquisitionOffer["status"];
  createdAt: Date;
  submittedAt?: Date;
}>;
export type AcquisitionCounterpartyResponseWorkspaceSummary = Readonly<{
  id: string;
  type: "accepted" | "rejected" | "countered";
  offerId: string;
  respondedAt: Date;
  counterpartyType: CounterpartyResponse["counterparty"]["type"];
  headlineTerms?: AcquisitionOfferHeadlineTerms;
  explanation?: string;
}>;
export type AcquisitionAcceptedAgreementWorkspaceSummary = Readonly<{
  source: "offer" | "counteroffer" | "external";
  acceptedAt: Date;
  offerId?: string;
  responseId?: string;
  externalReferencePresent: boolean;
  headlineTerms: AcquisitionOfferHeadlineTerms | AcquisitionContractHeadlineTerms;
}>;
export type AcquisitionOperatingPermissionWorkspaceSummary = Readonly<{ status: "explicitly-authorized" | "not-authorized" | "unclear"; form?: string }>;
export type AcquisitionContractWorkspaceSummary = Readonly<{
  id: string;
  source: "accepted-offer" | "accepted-counteroffer" | "external-agreement";
  route: InvestmentOpportunityRoute;
  recordedAt: Date;
  effectiveDate: Date;
  headlineTerms: AcquisitionContractHeadlineTerms;
  operatingPermission?: AcquisitionOperatingPermissionWorkspaceSummary;
}>;
export type AcquisitionAlignmentWorkspaceSummary = Readonly<{ status: "aligned" | "changed" | "unavailable"; differences: readonly string[] }>;
export type AcquisitionCommercialWorkspaceSummary = Readonly<{
  currentOffer: AcquisitionOfferWorkspaceSummary | null;
  priorOffers: readonly AcquisitionOfferHistoryWorkspaceSummary[];
  priorOfferTotalCount: number;
  priorOffersTruncated: boolean;
  latestResponse: AcquisitionCounterpartyResponseWorkspaceSummary | null;
  acceptedAgreement: AcquisitionAcceptedAgreementWorkspaceSummary | null;
  contract: AcquisitionContractWorkspaceSummary | null;
  analysisAlignment: AcquisitionAlignmentWorkspaceSummary | null;
  contractAlignment: AcquisitionAlignmentWorkspaceSummary | null;
}>;

export type AcquisitionRequirementConcernSummary = Readonly<{
  highestSeverity: "low" | "moderate" | "high" | "critical";
  total: number;
  blocking: number;
  headline?: string;
}>;
export type AcquisitionRequirementWorkspaceItem = Readonly<{
  id: string;
  kind: "contingency" | "due-diligence";
  title: string;
  typeOrCategory: string;
  status: "not-started" | "in-progress" | "satisfied" | "waived" | "failed" | "not-applicable";
  priority: "low" | "normal" | "high" | "critical";
  blocking: boolean;
  dueAt?: Date;
  overdue: boolean;
  linkedActionCount: number;
  evidenceCount: number;
  documentCount: number;
  unavailableActionCount: number;
  unavailableEvidenceCount: number;
  concernSummary?: AcquisitionRequirementConcernSummary;
  resolvedAt?: Date;
}>;
export type AcquisitionRequirementCounts = Readonly<{
  contingencies: number;
  dueDiligence: number;
  notStarted: number;
  inProgress: number;
  satisfied: number;
  waived: number;
  failed: number;
  notApplicable: number;
}>;
export type AcquisitionRequirementsWorkspaceSummary = Readonly<{
  initialized: boolean;
  totals: AcquisitionRequirementCounts;
  blocking: readonly AcquisitionRequirementWorkspaceItem[];
  blockingTotalCount: number;
  blockingTruncated: boolean;
  highPriority: readonly AcquisitionRequirementWorkspaceItem[];
  highPriorityTotalCount: number;
  highPriorityTruncated: boolean;
  recentlyResolved: readonly AcquisitionRequirementWorkspaceItem[];
  recentlyResolvedTotalCount: number;
  recentlyResolvedTruncated: boolean;
  waivedCount: number;
  failedCount: number;
  unresolvedCriticalConcernCount: number;
}>;

export type AcquisitionClosingReadinessWorkspaceSummary = Readonly<{
  status: "not-ready" | "conditionally-ready" | "ready";
  evaluatedAt: Date;
  evaluatedPipelineVersion: number;
  current: boolean;
  blockers: readonly Readonly<{ code: string; sourceType: "pipeline" | "contract" | "contingency" | "due-diligence" | "action" | "evidence"; sourceId?: string; title: string; explanation: string; resolvable: boolean }>[];
  blockerTotalCount: number;
  blockersTruncated: boolean;
  warnings: readonly Readonly<{ code: string; sourceId?: string; title: string; explanation: string }>[];
  warningTotalCount: number;
  warningsTruncated: boolean;
  counts: Readonly<{ requiredContingencies: number; unresolvedContingencies: number; requiredDiligence: number; unresolvedDiligence: number; waived: number; failed: number }>;
}>;

export type AcquisitionActivityWorkspaceItem = Readonly<{
  id: string;
  type: AcquisitionActivity["type"];
  occurredAt: Date;
  actor: AcquisitionWorkspaceActorSummary;
  summary: string;
  references: readonly Readonly<{ type: "offer" | "response" | "contract" | "requirement" | "stage"; id: string }>[];
}>;
export type AcquisitionActivityWorkspaceSummary = Readonly<{ items: readonly AcquisitionActivityWorkspaceItem[]; totalCount: number; truncated: boolean }>;
export type AcquisitionWorkspaceHealth = Readonly<{ level: "healthy" | "attention" | "blocked" | "terminal"; reasons: readonly Readonly<{ code: string; message: string }>[] }>;

export type AcquisitionClosingFactsWorkspaceSummary =
  | Readonly<{ route: "purchase"; closedAt: Date; finalPurchasePrice: AcquisitionWorkspaceMoney; financingType: "cash" | "financed" }>
  | Readonly<{ route: "rental-arbitrage"; agreementExecutedAt: Date; commencementAt: Date; finalMonthlyRent: AcquisitionWorkspaceMoney; operatingPermissionStatus: "explicitly-authorized" | "unclear" | "not-authorized" }>;
export type AcquisitionTerminalOutcomeSummary =
  | Readonly<{ type: "acquired"; closedAt: Date; closingFacts: AcquisitionClosingFactsWorkspaceSummary }>
  | Readonly<{ type: "exited"; exitedAt: Date; exitedFromStage: Exclude<AcquisitionStage, "closed-acquired" | "exited">; reason: AcquisitionExit["reason"]; explanation?: string; reconsiderationEligible: boolean; reconsiderationNotBefore?: Date }>;

type AcquisitionPipelineWorkspaceBase = Readonly<{
  pipelineId: string;
  route: InvestmentOpportunityRoute;
  stage: AcquisitionStage;
  stageLabel: string;
  stageCategory: AcquisitionStageCategory;
  activatedAt: Date;
  activatedBy: AcquisitionWorkspaceActorSummary;
  lifecycle: AcquisitionLifecycleWorkspaceSummary;
  commercial: AcquisitionCommercialWorkspaceSummary;
  requirements: AcquisitionRequirementsWorkspaceSummary;
  readiness: AcquisitionClosingReadinessWorkspaceSummary | null;
  activity: AcquisitionActivityWorkspaceSummary;
  health: AcquisitionWorkspaceHealth;
  updatedAt: Date;
}>;
export type AcquisitionPipelineWorkspaceSummary = AcquisitionPipelineWorkspaceBase & Readonly<{ terminal: false }>;
export type AcquisitionPipelineTerminalWorkspaceSummary = AcquisitionPipelineWorkspaceBase & Readonly<{ terminal: true; stage: "closed-acquired" | "exited"; outcome: AcquisitionTerminalOutcomeSummary }>;

export type AcquisitionWorkspaceCapabilityName = "read" | "activate" | "manageOffers" | "recordContract" | "manageRequirements" | "prepareClosing" | "close" | "exit";
export type AcquisitionCapabilityAvailability =
  | Readonly<{ status: "available" }>
  | Readonly<{ status: "unauthorized"; reasonCode: string }>
  | Readonly<{ status: "not-applicable"; reasonCode: string }>
  | Readonly<{ status: "blocked"; reasonCode: string; blockers: readonly AcquisitionWorkspaceBlocker[] }>
  | Readonly<{ status: "not-deployed"; reasonCode: string }>
  | Readonly<{ status: "not-verified"; reasonCode: string }>
  | Readonly<{ status: "dependency-unavailable"; reasonCode: string }>;
export type AcquisitionWorkspaceCapabilities = Readonly<Record<AcquisitionWorkspaceCapabilityName, AcquisitionCapabilityAvailability>>;
export type AcquisitionCapabilityLimitation = Readonly<{
  code: "REMOTE_TRANSACTION_NOT_VERIFIED" | "REMOTE_RLS_NOT_VERIFIED" | "ACTION_STATE_UNAVAILABLE" | "EVIDENCE_STATE_UNAVAILABLE" | "DOCUMENT_READER_UNAVAILABLE" | "EVENT_DELIVERY_NOT_DURABLE";
  affects: readonly AcquisitionWorkspaceCapabilityName[];
  severity: "informational" | "warning" | "blocking";
  operatorMessage: string;
}>;

export type AcquisitionWorkspaceVersions = Readonly<{ opportunityVersion: number; pipelineVersion?: number; latestAnalysisVersion?: number; readinessPipelineVersion?: number }>;
export type AcquisitionWorkspaceCommandType = "activate" | "create-offer" | "edit-offer" | "submit-offer" | "record-response" | "record-contract" | "initialize-requirements" | "manage-requirements" | "prepare-closing" | "close" | "exit";
export type AcquisitionWorkspaceCommandDescriptor = Readonly<{
  commandType: AcquisitionWorkspaceCommandType;
  opportunityId: string;
  pipelineId?: string;
  expectedOpportunityVersion: number;
  expectedPipelineVersion?: number;
}>;
export type AcquisitionWorkspaceActionType = "activate-pipeline" | "create-offer" | "edit-offer" | "submit-offer" | "record-response" | "record-contract" | "initialize-requirements" | "manage-due-diligence" | "review-closing-readiness" | "begin-closing-preparation" | "close-acquisition" | "exit-pipeline" | "review-analysis" | "reanalyze-opportunity";
export type AcquisitionWorkspaceNextAction = Readonly<{
  id: string;
  type: AcquisitionWorkspaceActionType;
  label: string;
  description: string;
  enabled: boolean;
  priority: "primary" | "secondary" | "tertiary";
  href?: string;
  command?: AcquisitionWorkspaceCommandDescriptor;
  blockers: readonly AcquisitionWorkspaceBlocker[];
}>;

export type AcquisitionOpportunityOnlyWorkspace = Readonly<{ status: "opportunity-only"; opportunity: InvestmentOpportunityWorkspaceSummary; analysis: InvestmentAnalysisWorkspaceSummary | null; activation: AcquisitionActivationSummary; capabilities: AcquisitionWorkspaceCapabilities; versions: AcquisitionWorkspaceVersions; limitations: readonly AcquisitionCapabilityLimitation[] }>;
export type AcquisitionActiveWorkspace = Readonly<{ status: "pipeline-active"; opportunity: InvestmentOpportunityWorkspaceSummary; analysis: InvestmentAnalysisWorkspaceSummary | null; acquisition: AcquisitionPipelineWorkspaceSummary; capabilities: AcquisitionWorkspaceCapabilities; nextActions: readonly AcquisitionWorkspaceNextAction[]; versions: AcquisitionWorkspaceVersions; limitations: readonly AcquisitionCapabilityLimitation[] }>;
export type AcquisitionTerminalWorkspace = Readonly<{ status: "pipeline-terminal"; opportunity: InvestmentOpportunityWorkspaceSummary; analysis: InvestmentAnalysisWorkspaceSummary | null; acquisition: AcquisitionPipelineTerminalWorkspaceSummary; capabilities: AcquisitionWorkspaceCapabilities; nextActions: readonly AcquisitionWorkspaceNextAction[]; versions: AcquisitionWorkspaceVersions; limitations: readonly AcquisitionCapabilityLimitation[] }>;
export type AcquisitionUnavailableWorkspace = Readonly<{ status: "acquisition-unavailable"; opportunity: InvestmentOpportunityWorkspaceSummary; analysis: InvestmentAnalysisWorkspaceSummary | null; reason: AcquisitionWorkspaceUnavailableReason; capabilities: AcquisitionWorkspaceCapabilities; versions: AcquisitionWorkspaceVersions; limitations: readonly AcquisitionCapabilityLimitation[] }>;
export type AcquisitionWorkspace = AcquisitionOpportunityOnlyWorkspace | AcquisitionActiveWorkspace | AcquisitionTerminalWorkspace | AcquisitionUnavailableWorkspace;
export type AcquisitionWorkspaceUnavailableReason = Readonly<{ code: "PIPELINE_UNAVAILABLE" | "PIPELINE_INVALID"; retryable: boolean; message: string }>;

export type AcquisitionWorkspaceQueryError =
  | Readonly<{ code: "ACQUISITION_WORKSPACE_NOT_AUTHENTICATED" }>
  | Readonly<{ code: "ACQUISITION_WORKSPACE_NOT_FOUND" }>
  | Readonly<{ code: "ACQUISITION_WORKSPACE_NOT_AUTHORIZED" }>
  | Readonly<{ code: "ACQUISITION_WORKSPACE_INPUT_INVALID"; field?: string }>
  | Readonly<{ code: "ACQUISITION_WORKSPACE_OPPORTUNITY_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "ACQUISITION_WORKSPACE_PIPELINE_INVALID"; retryable: boolean }>
  | Readonly<{ code: "ACQUISITION_WORKSPACE_DEPENDENCY_UNAVAILABLE"; dependency: "analysis" | "actions" | "evidence" | "documents"; retryable: boolean }>
  | Readonly<{ code: "ACQUISITION_WORKSPACE_UNEXPECTED"; correlationId?: string }>;

export type AcquisitionWorkspaceOpportunitySource = Readonly<{
  id: InvestmentOpportunityId;
  ownerId: string;
  version: number;
  name: string;
  location: AcquisitionWorkspaceLocation;
  route: InvestmentOpportunityRoute;
  status: OpportunityStatus;
  archived: boolean;
  tags: readonly string[];
  createdAt: Date;
  updatedAt: Date;
  headlineValue?: AcquisitionWorkspaceHeadlineValue;
}>;
export type AcquisitionWorkspaceAnalysisSource = Readonly<{
  analysisId: OpportunityAnalysisId;
  opportunityId: InvestmentOpportunityId;
  version: number;
  analyzedAt: Date;
  route: InvestmentOpportunityRoute;
  recommendation: InvestmentAnalysisWorkspaceSummary["recommendation"];
  score?: number;
  confidence?: InvestmentAnalysisWorkspaceSummary["confidence"];
  assumptionFingerprint?: string;
  complete: boolean;
}>;
export type AcquisitionWorkspacePipelineSource = Readonly<{
  id: string;
  opportunityId: InvestmentOpportunityId;
  route: InvestmentOpportunityRoute;
  stage: AcquisitionStage;
  version: number;
  activation: Readonly<{ activatedAt: Date; activatedBy: AcquisitionActorReference }>;
  offers: readonly AcquisitionOffer[];
  responses: readonly CounterpartyResponse[];
  acceptedAgreement?: AcceptedAgreementBasis;
  contract?: AcquisitionContract;
  contingencies: readonly AcquisitionContingency[];
  dueDiligenceItems: readonly DueDiligenceItem[];
  closingFacts?: AcquisitionClosingFacts;
  exit?: AcquisitionExit;
  stageHistory: readonly AcquisitionStageHistoryEntry[];
  activity: readonly AcquisitionActivity[];
  readiness?: AcquisitionClosingReadiness;
  analysisAlignment?: AcquisitionAlignmentWorkspaceSummary;
  contractAlignment?: AcquisitionAlignmentWorkspaceSummary;
  updatedAt: Date;
}>;

export type AcquisitionWorkspaceActionState = Readonly<{ actionId: string; status: string; blocked: boolean; updatedAt: Date }>;
export type AcquisitionWorkspaceEvidenceState = Readonly<{ evidenceId: string; available: boolean; state: "available" | "withdrawn" | "superseded" | "unavailable"; updatedAt?: Date }>;
export type AcquisitionWorkspaceAuthorizationSource = Readonly<{ authenticated: boolean; canRead: boolean; capabilities: Readonly<Record<Exclude<AcquisitionWorkspaceCapabilityName, "read">, boolean>> }>;
export type AcquisitionWorkspaceDeploymentStatus = Readonly<{
  readDeployed: boolean;
  commandsDeployed: boolean;
  remoteTransactionsVerified: boolean;
  remoteRlsVerified: boolean;
  eventDeliveryDurable: boolean;
  documentReaderAvailable: boolean;
}>;

export interface AcquisitionWorkspaceOpportunityReader { findOpportunity(input: Readonly<{ ownerId: string; opportunityId: InvestmentOpportunityId }>): Promise<AcquisitionWorkspaceOpportunitySource | null>; }
export interface AcquisitionWorkspaceAnalysisReader { findLatestCompletedAnalysis(input: Readonly<{ ownerId: string; opportunityId: InvestmentOpportunityId }>): Promise<AcquisitionWorkspaceAnalysisSource | null>; }
export interface AcquisitionWorkspacePipelineReader { findByOpportunity(input: Readonly<{ ownerId: string; opportunityId: InvestmentOpportunityId; evaluatedAt: Date }>): Promise<AcquisitionWorkspacePipelineSource | null>; }
export interface AcquisitionWorkspaceActionReader { getActionStates(input: Readonly<{ ownerId: string; actionIds: readonly string[] }>): Promise<readonly AcquisitionWorkspaceActionState[]>; }
export interface AcquisitionWorkspaceEvidenceReader { getEvidenceStates(input: Readonly<{ ownerId: string; evidenceIds: readonly string[] }>): Promise<readonly AcquisitionWorkspaceEvidenceState[]>; }
export interface AcquisitionWorkspaceAuthorizer { authorize(input: Readonly<{ ownerId: string; actor: AcquisitionActorReference; opportunityId: InvestmentOpportunityId }>): Promise<AcquisitionWorkspaceAuthorizationSource>; }

export type AcquisitionWorkspaceQueryOperation =
  | "authorization"
  | "opportunity-reader"
  | "analysis-reader"
  | "pipeline-reader"
  | "action-reader"
  | "evidence-reader"
  | "projection";
export interface AcquisitionWorkspaceQueryObserver {
  measure<T>(operation: AcquisitionWorkspaceQueryOperation, work: () => Promise<T>): Promise<T>;
  measureSync<T>(operation: AcquisitionWorkspaceQueryOperation, work: () => T): T;
}

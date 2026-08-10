import type { HpmLifecycleStage, HpmPresentationState, HpmSourceCapability } from "./hpm-vocabulary";

export type HpmScopeType = "property" | "property-cohort" | "portfolio" | "owner";
export type HpmFreshness = "current" | "delayed" | "stale" | "incomplete" | "unavailable" | "not-configured" | "not-applicable";
export type HpmLifecycleHealth = "healthy" | "attention-needed" | "at-risk" | "blocked" | "awaiting-authority" | "awaiting-external-dependency" | "awaiting-measurement" | "incomplete-context" | "stale" | "not-applicable";
export type HpmRelationshipAuthority = "explicit" | "inferred";

export type HpmProjectionScope = Readonly<{
  tenantId: string;
  type: HpmScopeType;
  portfolioId?: string;
  propertyIds: readonly string[];
  ownerId?: string;
  timeZone: string;
  from: string;
  to: string;
  comparisonFrom?: string;
  comparisonTo?: string;
}>;

export type HpmSourceReference = Readonly<{
  capability: HpmSourceCapability;
  recordType: string;
  recordId: string;
  recordVersion: string;
}>;

export type HpmValidNextCommand = Readonly<{
  type: string;
  owningCapability: HpmSourceCapability;
  target: HpmSourceReference;
  expectedVersion: string;
  requiredAuthority: string;
  availability: "available" | "unavailable";
  unavailableReason?: string;
  destination?: string;
  correlationId: string;
  vocabularyVersion?: string;
  intentKey?: string;
  requiredInputs?: readonly Readonly<{ name: string; type: "string" | "number" | "boolean" | "timestamp"; required: boolean }>[];
  requiresConfirmation?: boolean;
  requiresReason?: boolean;
  requiresRationale?: boolean;
  requiresAcknowledgement?: boolean;
  requiresReviewAuthority?: boolean;
  idempotencyRequired?: boolean;
  dispatchKey?: string;
  resultBehavior?: "refresh-projection" | "destination" | "none";
}>;

export type HpmProjectedRecord = Readonly<{
  tenantId: string;
  source: HpmSourceReference;
  stage: HpmLifecycleStage;
  canonicalStatus: string;
  presentationState: HpmPresentationState;
  summary: string;
  propertyIds: readonly string[];
  portfolioId?: string;
  ownerId?: string;
  attentionState: "none" | "attention" | "urgent";
  attentionRank?: number;
  responsibleOwnerId?: string;
  responsibleRole?: string;
  confidence?: "high" | "medium" | "low" | "unknown";
  dataQuality?: string;
  blocker?: string;
  correlationId?: string;
  causationId?: string;
  canonicalThreadId?: string;
  expectedNextStage?: HpmLifecycleStage;
  relationships?: readonly HpmProjectedRelationship[];
  healthSignals?: readonly HpmHealthSignal[];
  attentionSignals?: readonly HpmAttentionSignal[];
  validNextCommands: readonly HpmValidNextCommand[];
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  measuredAt?: string;
  resolvedAt?: string;
  visibility: "tenant" | "property" | "portfolio" | "restricted";
}>;

export type HpmAttentionClassification =
  | "critical-risk"
  | "blocked"
  | "awaiting-authority"
  | "overdue"
  | "required-review"
  | "required-context"
  | "dependency-required"
  | "handoff-required"
  | "measurement-required"
  | "reevaluation-required"
  | "conflict-resolution-required"
  | "expiring"
  | "stale-source"
  | "incomplete-coverage"
  | "follow-up-required";

export type HpmAttentionReasonCode =
  | "active-source-invalidated"
  | "critical-guardrail-breach"
  | "material-risk-review"
  | "lifecycle-blocking-conflict"
  | "required-handoff-broken"
  | "authority-overdue"
  | "review-overdue"
  | "accepted-handoff-required"
  | "critical-execution-blocked"
  | "measurement-overdue"
  | "learning-reevaluation-required"
  | "context-required"
  | "deferred-review-due"
  | "expiration-approaching"
  | "material-source-stale"
  | "follow-up-required";

export type HpmAttentionSignal = Readonly<{
  reasonCode: HpmAttentionReasonCode;
  classification: HpmAttentionClassification;
  severity: "critical" | "high" | "medium" | "low";
  urgency: "breached" | "due" | "approaching" | "none";
  lifecycleImpact: "invalidates-active" | "blocks-lifecycle" | "delays-lifecycle" | "follow-up";
  scopeImpact: "portfolio" | "multi-property" | "property" | "record";
  requiresHumanAuthority: boolean;
  dependencyImpact: "blocking" | "material" | "none";
  admittedByRule: string;
  safeFactCodes: readonly string[];
  dueAt?: string;
  ageBasisAt?: string;
}>;

export type HpmProjectedRelationship = Readonly<{
  type: string;
  target: HpmSourceReference;
  authority: HpmRelationshipAuthority;
  explanationCode: string;
  createdAt?: string;
  correlationId?: string;
  causationId?: string;
}>;

export type HpmHealthSignalCode =
  | "high-severity-finding"
  | "decision-review-overdue"
  | "execution-linkage-missing"
  | "critical-execution-blocked"
  | "completion-evidence-missing"
  | "measurement-awaiting"
  | "measurement-overdue"
  | "outcome-guardrail-breached"
  | "lesson-reevaluation-required"
  | "recommendation-learning-changed"
  | "lineage-broken"
  | "context-missing"
  | "authorization-awaiting"
  | "external-dependency-awaiting";

export type HpmHealthSignal = Readonly<{
  code: HpmHealthSignalCode;
  source: HpmSourceReference;
  explanation: string;
}>;

export type HpmLineageRelationship = Readonly<{
  type: string;
  source: HpmSourceReference;
  target: HpmSourceReference;
  authority: HpmRelationshipAuthority;
  associationPolicyVersion?: string;
  explanationCode?: string;
  createdAt: string;
  correlationId?: string;
  causationId?: string;
  access: "available" | "restricted";
}>;

export type HpmLifecycleThread = Readonly<{
  threadKey: string;
  scope: HpmProjectionScope;
  origin: HpmSourceReference;
  records: readonly HpmProjectedRecord[];
  relationships: readonly HpmLineageRelationship[];
  currentStage: HpmLifecycleStage;
  authoritativeOwner?: Readonly<{ capability: HpmSourceCapability; ownerId?: string; role?: string }>;
  health: HpmLifecycleHealth;
  healthReasons: readonly string[];
  blockers: readonly string[];
  missingStages: readonly HpmLifecycleStage[];
  timeline: readonly Readonly<{ at: string; source: HpmSourceReference; event: string }>[];
  primaryNextCommand?: HpmValidNextCommand;
  partial: boolean;
  freshness: HpmFreshness;
  firstObservedAt: string;
  lastChangedAt: string;
  asOf: string;
}>;

export type HpmStageSummary = Readonly<{
  stage: HpmLifecycleStage;
  vocabularyVersion?: string;
  availability?: "available" | "partial" | "unavailable" | "not-configured" | "not-applicable";
  visibleCount: number;
  activeCount?: number;
  completedCount?: number;
  blockedCount?: number;
  requiringReviewCount?: number;
  attentionCount: number;
  health: HpmLifecycleHealth;
  healthReasonCodes?: readonly string[];
  freshness: HpmFreshness;
  asOf: string;
  lastSuccessfulAsOf?: string;
  oldestUnresolvedAt?: string;
  sourceVersions?: readonly Readonly<{ capability: HpmSourceCapability; contractVersion?: string; sourceVersion?: string; policyVersion: string }>[];
  dataGaps?: readonly string[];
  limitations?: readonly string[];
}>;

export type HpmAttentionItem = Readonly<{
  id: string;
  rank: number;
  reason: string;
  rankExplanation: string;
  stage: HpmLifecycleStage;
  authoritativeRecord: HpmSourceReference;
  scope: HpmProjectionScope;
  severity: "critical" | "high" | "medium" | "low";
  ownerId?: string;
  ownerRole?: string;
  dueAt?: string;
  blocker?: string;
  primaryNextCommand?: HpmValidNextCommand;
  itemKey?: string;
  rankBucket?: number;
  rankTuple?: readonly (number | string)[];
  currentLifecyclePosition?: HpmLifecycleStage;
  classification?: HpmAttentionClassification;
  urgency?: HpmAttentionSignal["urgency"];
  lifecycleImpact?: HpmAttentionSignal["lifecycleImpact"];
  reasonCodes?: readonly HpmAttentionReasonCode[];
  explanation?: Readonly<{ admissionRule: string; policyVersion: string; tuple: readonly (number | string)[]; safeFactCodes: readonly string[]; caveats: readonly string[]; owningCapability: HpmSourceCapability }>;
  ageBasisAt?: string;
  ageMs?: number;
  freshness?: HpmFreshness;
  partial?: boolean;
  validNextCommands?: readonly HpmValidNextCommand[];
  detailDestination?: string;
  evaluatedAt?: string;
}>;

export type HpmSourceState = Readonly<{
  capability: HpmSourceCapability;
  contractVersion?: string;
  freshness: HpmFreshness;
  asOf?: string;
  sourceVersion?: string;
  policyVersion: string;
  failureClassification?: string;
  observedAt?: string;
  lastSuccessfulAsOf?: string;
  reasonCode?: string;
  operationalReviewRequired?: boolean;
  contributesToCounts?: boolean;
  contributesToHealth?: boolean;
  contributesToLineage?: boolean;
}>;

export type HpmLifecycleProjection = Readonly<{
  projectionId?: string;
  projectionPolicyVersion: string;
  scope: HpmProjectionScope;
  projectedAt: string;
  asOf: string;
  health: HpmLifecycleHealth;
  healthReasons: readonly string[];
  stages: readonly HpmStageSummary[];
  attention: readonly HpmAttentionItem[];
  threads: readonly HpmLifecycleThread[];
  recentlyChanged: readonly HpmProjectedRecord[];
  lineage: readonly HpmLineageRelationship[];
  sourceStates: readonly HpmSourceState[];
  partial: boolean;
  completeness?: "complete" | "partial" | "unavailable";
  policyVersions?: Readonly<{ lifecycle: string; health: string; lineage: string; freshness: string }>;
  coverage?: Readonly<{ applicableSources: number; availableSources: number; limitations: readonly string[] }>;
  failures?: readonly Readonly<{ capability: HpmSourceCapability; classification: HpmFailureCode; message: string }>[];
  validNextCommands: readonly HpmValidNextCommand[];
  reports: readonly Readonly<{ definitionId: string; policyVersion: string; href: string }>[];
}>;

export type HpmFailureCode =
  | "HPM_SCOPE_NOT_FOUND"
  | "HPM_SCOPE_ACCESS_DENIED"
  | "HPM_PROJECTION_UNAVAILABLE"
  | "HPM_PROJECTION_PARTIAL"
  | "HPM_SOURCE_UNAVAILABLE"
  | "HPM_SOURCE_STALE"
  | "HPM_SOURCE_VERSION_CONFLICT"
  | "HPM_LINEAGE_INCOMPLETE"
  | "HPM_LINEAGE_INVALID"
  | "HPM_THREAD_NOT_FOUND"
  | "HPM_THREAD_ACCESS_DENIED"
  | "HPM_COMMAND_NOT_AVAILABLE"
  | "HPM_COMMAND_UNAUTHORIZED"
  | "HPM_COMMAND_TARGET_CHANGED"
  | "HPM_HANDOFF_FAILED"
  | "HPM_REPORT_NOT_FOUND"
  | "HPM_REPORT_ACCESS_DENIED"
  | "HPM_REPORT_DEFINITION_INVALID"
  | "HPM_EXPORT_FAILED"
  | "HPM_REFRESH_ALREADY_IN_PROGRESS"
  | "HPM_PROJECTION_POLICY_MISMATCH"
  | "CONCURRENT_MODIFICATION";

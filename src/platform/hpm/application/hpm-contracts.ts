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
  validNextCommands: readonly HpmValidNextCommand[];
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  measuredAt?: string;
  resolvedAt?: string;
  visibility: "tenant" | "property" | "portfolio" | "restricted";
}>;

export type HpmLineageRelationship = Readonly<{
  type: string;
  source: HpmSourceReference;
  target: HpmSourceReference;
  authority: HpmRelationshipAuthority;
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
}>;

export type HpmStageSummary = Readonly<{
  stage: HpmLifecycleStage;
  visibleCount: number;
  attentionCount: number;
  health: HpmLifecycleHealth;
  freshness: HpmFreshness;
  asOf: string;
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
}>;

export type HpmSourceState = Readonly<{
  capability: HpmSourceCapability;
  freshness: HpmFreshness;
  asOf?: string;
  sourceVersion?: string;
  policyVersion: string;
  failureClassification?: string;
}>;

export type HpmLifecycleProjection = Readonly<{
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

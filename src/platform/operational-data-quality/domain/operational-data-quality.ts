export const OPERATIONAL_DATA_QUALITY_POLICY = Object.freeze({
  id: "luxe-haven-operational-data-quality",
  version: "1.0.0",
});

export type OperationalDataQualityStatus =
  | "trusted"
  | "usable-with-gaps"
  | "attention-needed"
  | "degraded"
  | "unusable"
  | "unknown";
export type QualityDimension =
  | "freshness"
  | "completeness"
  | "consistency"
  | "uniqueness"
  | "provenance";
export type DataQualitySeverity = "information" | "warning" | "critical";
export type DataQualityResolutionState =
  | "open"
  | "acknowledged"
  | "resolved"
  | "superseded"
  | "ignored-by-policy";
export type FreshnessBand =
  | "current"
  | "aging"
  | "stale"
  | "expired"
  | "unknown";
export type SynchronizationRunStatus =
  | "succeeded"
  | "partially-succeeded"
  | "failed"
  | "skipped"
  | "in-progress"
  | "never-run";
export type RecordSynchronizationState =
  | "current"
  | "pending-update"
  | "failed-update"
  | "orphaned"
  | "disconnected-source"
  | "unknown";
export type KnownValue<T> =
  | Readonly<{ state: "known"; value: T }>
  | Readonly<{
      state: "unknown" | "unavailable" | "not-applicable" | "not-synchronized";
    }>;

export const dataQualityIssueCodes = [
  "BOOKING_MISSING_PROPERTY",
  "BOOKING_INVALID_DATE_RANGE",
  "BOOKING_STATUS_DATE_CONFLICT",
  "BOOKING_DUPLICATE_PROVIDER_REFERENCE",
  "BOOKING_POTENTIAL_DUPLICATE",
  "BOOKING_STALE",
  "RESERVATION_GUEST_MISSING",
  "RESERVATION_GUEST_PROVISIONAL",
  "RESERVATION_CONTACT_UNAVAILABLE",
  "RESERVATION_PARTY_INCONSISTENT",
  "PROPERTY_TIMEZONE_MISSING",
  "PROPERTY_WORKSPACE_MISMATCH",
  "PROVIDER_REFERENCE_MISSING",
  "PROVIDER_RECORD_CONFLICT",
  "SYNC_NEVER_COMPLETED",
  "SYNC_STALE",
  "SYNC_PARTIAL_FAILURE",
  "SYNC_FAILED",
  "SOURCE_DISCONNECTED",
  "PROVENANCE_INCOMPLETE",
] as const;
export type DataQualityIssueCode = (typeof dataQualityIssueCodes)[number];

export type DataQualityEvidence = Readonly<{
  kind: "observation" | "field" | "relationship" | "synchronization";
  statement: string;
  sourceReference?: string;
  observedAt?: string;
}>;
export type DataQualityScope = Readonly<{
  workspaceId: string;
  recordType: "booking" | "reservation-context" | "property" | "sync-run";
  recordId: string;
  field?: string;
}>;
export type DataQualityIssue = Readonly<{
  code: DataQualityIssueCode;
  severity: DataQualitySeverity;
  scope: DataQualityScope;
  evidence: readonly DataQualityEvidence[];
  impact: string;
  suggestedResolution: string;
  firstObservedAt: string;
  lastObservedAt: string;
  resolutionState: DataQualityResolutionState;
}>;
export type QualityDimensionResult = Readonly<{
  status: OperationalDataQualityStatus;
  evidence: readonly string[];
  impact: string;
  action: string | null;
}>;
export type OperationalDataQuality = Readonly<{
  status: OperationalDataQualityStatus;
  dimensions: Readonly<Record<QualityDimension, QualityDimensionResult>>;
  issues: readonly DataQualityIssue[];
  evaluatedAt: string;
  policyId: string;
  policyVersion: string;
}>;

export const issueDefinitions: Readonly<
  Record<
    DataQualityIssueCode,
    Readonly<{
      severity: DataQualitySeverity;
      impact: string;
      resolution: string;
    }>
  >
> = {
  BOOKING_MISSING_PROPERTY: { severity: "critical", impact: "The stay cannot be assigned to an operating location.", resolution: "Link the reservation to an owned property." },
  BOOKING_INVALID_DATE_RANGE: { severity: "critical", impact: "The stay window cannot be operated safely.", resolution: "Review the reservation dates at the connected source." },
  BOOKING_STATUS_DATE_CONFLICT: { severity: "warning", impact: "Occupancy and stay-stage views may be inaccurate.", resolution: "Review the reservation status and dates." },
  BOOKING_DUPLICATE_PROVIDER_REFERENCE: { severity: "critical", impact: "One provider reservation maps to multiple canonical bookings.", resolution: "Reconcile the provider reference without deleting either record." },
  BOOKING_POTENTIAL_DUPLICATE: { severity: "warning", impact: "Two visible stays may represent the same reservation.", resolution: "Review both source reservations before resolving." },
  BOOKING_STALE: { severity: "warning", impact: "Recent reservation changes may be missing.", resolution: "Synchronize the connected hospitality platform." },
  RESERVATION_GUEST_MISSING: { severity: "critical", impact: "The operator cannot identify the primary guest.", resolution: "Review the source reservation guest." },
  RESERVATION_GUEST_PROVISIONAL: { severity: "information", impact: "The stay remains usable with an unconfirmed guest identity.", resolution: "Confirm identity when stronger provider evidence becomes available." },
  RESERVATION_CONTACT_UNAVAILABLE: { severity: "warning", impact: "Direct guest outreach may be unavailable.", resolution: "Use platform messaging or review the source reservation." },
  RESERVATION_PARTY_INCONSISTENT: { severity: "warning", impact: "Occupancy preparation may use an incorrect party size.", resolution: "Review the party composition at the source." },
  PROPERTY_TIMEZONE_MISSING: { severity: "warning", impact: "Stay timing uses a lower-confidence fallback.", resolution: "Configure the property timezone." },
  PROPERTY_WORKSPACE_MISMATCH: { severity: "critical", impact: "Workspace ownership cannot be trusted.", resolution: "Correct the property ownership relationship." },
  PROVIDER_REFERENCE_MISSING: { severity: "warning", impact: "Source reconciliation is limited.", resolution: "Synchronize a stable provider reservation reference." },
  PROVIDER_RECORD_CONFLICT: { severity: "critical", impact: "A material operational fact has competing trusted observations.", resolution: "Review the chosen value and conflicting observations." },
  SYNC_NEVER_COMPLETED: { severity: "warning", impact: "Operational records cannot be assumed current.", resolution: "Run the first synchronization." },
  SYNC_STALE: { severity: "warning", impact: "New provider changes may not be reflected.", resolution: "Retry synchronization." },
  SYNC_PARTIAL_FAILURE: { severity: "warning", impact: "Some records or capabilities were not refreshed.", resolution: "Review affected records and retry the failed portion." },
  SYNC_FAILED: { severity: "critical", impact: "No records from the latest attempt were refreshed.", resolution: "Review the connection and retry." },
  SOURCE_DISCONNECTED: { severity: "critical", impact: "New changes cannot synchronize.", resolution: "Reconnect the source in Workspace." },
  PROVENANCE_INCOMPLETE: { severity: "warning", impact: "The platform cannot fully explain the record origin.", resolution: "Refresh the record from its connected source." },
};

export function createQualityIssue(
  code: DataQualityIssueCode,
  scope: DataQualityScope,
  evidence: readonly DataQualityEvidence[],
  observedAt: string,
): DataQualityIssue {
  const definition = issueDefinitions[code];
  return {
    code,
    severity: definition.severity,
    scope,
    evidence,
    impact: definition.impact,
    suggestedResolution: definition.resolution,
    firstObservedAt: observedAt,
    lastObservedAt: observedAt,
    resolutionState: "open",
  };
}

const statusRank: Record<OperationalDataQualityStatus, number> = {
  trusted: 0,
  "usable-with-gaps": 1,
  "attention-needed": 2,
  degraded: 3,
  unusable: 4,
  unknown: 2,
};

export function aggregateQualityStatus(
  dimensions: Readonly<Record<QualityDimension, QualityDimensionResult>>,
): OperationalDataQualityStatus {
  const values = Object.values(dimensions).map(({ status }) => status);
  if (values.every((value) => value === "unknown")) return "unknown";
  const worst = values.reduce((worst, value) =>
    statusRank[value] > statusRank[worst] ? value : worst,
  "trusted");
  return worst === "unknown" ? "attention-needed" : worst;
}

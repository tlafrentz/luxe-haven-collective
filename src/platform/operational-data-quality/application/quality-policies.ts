import {
  OPERATIONAL_DATA_QUALITY_POLICY,
  aggregateQualityStatus,
  createQualityIssue,
  type DataQualityIssue,
  type DataQualityIssueCode,
  type DataQualityScope,
  type FreshnessBand,
  type KnownValue,
  type OperationalDataQuality,
  type OperationalDataQualityStatus,
  type QualityDimension,
  type QualityDimensionResult,
  type SynchronizationRunStatus,
} from "../domain";

export type CompletenessProfileId =
  | "booking-list"
  | "booking-detail"
  | "guest-communication"
  | "guidebook-delivery"
  | "operational-report"
  | "revenue-analysis";

export type CompletenessProfile = Readonly<{
  id: CompletenessProfileId;
  mandatory: readonly string[];
  recommended: readonly string[];
  irrelevant: readonly string[];
}>;

export const completenessProfiles: Readonly<
  Record<CompletenessProfileId, CompletenessProfile>
> = {
  "booking-list": { id: "booking-list", mandatory: ["bookingId", "workspaceId", "propertyId", "arrival", "departure", "status", "providerReference"], recommended: ["guestId", "partyTotal"], irrelevant: ["contact", "currency"] },
  "booking-detail": { id: "booking-detail", mandatory: ["bookingId", "workspaceId", "propertyId", "arrival", "departure", "status", "providerReference"], recommended: ["guestId", "partyTotal", "contact", "currency"], irrelevant: [] },
  "guest-communication": { id: "guest-communication", mandatory: ["bookingId", "workspaceId", "propertyId", "arrival", "departure", "guestId", "stayStage"], recommended: ["contact", "language"], irrelevant: ["currency"] },
  "guidebook-delivery": { id: "guidebook-delivery", mandatory: ["bookingId", "workspaceId", "propertyId", "arrival", "departure", "stayStage"], recommended: ["guestId"], irrelevant: ["contact", "currency"] },
  "operational-report": { id: "operational-report", mandatory: ["bookingId", "workspaceId", "propertyId", "arrival", "departure", "status"], recommended: ["guestId", "partyTotal"], irrelevant: ["contact"] },
  "revenue-analysis": { id: "revenue-analysis", mandatory: ["bookingId", "workspaceId", "propertyId", "arrival", "departure", "status", "currency", "revenue"], recommended: ["providerReference"], irrelevant: ["contact", "language"] },
};

export type FreshnessPolicy = Readonly<{
  currentHours: number;
  agingHours: number;
  staleHours: number;
}>;

const freshnessPolicies: Readonly<Record<string, FreshnessPolicy>> = {
  "booking:arriving-today": { currentHours: 2, agingHours: 6, staleHours: 18 },
  "booking:in-stay": { currentHours: 4, agingHours: 12, staleHours: 24 },
  "booking:default": { currentHours: 6, agingHours: 24, staleHours: 72 },
  "booking:historical-report": { currentHours: 24 * 365, agingHours: 24 * 730, staleHours: 24 * 1095 },
  "property:default": { currentHours: 24 * 7, agingHours: 24 * 30, staleHours: 24 * 90 },
};

export function evaluateFreshness(
  observedAt: string | null,
  now: Date,
  policyKey = "booking:default",
): Readonly<{ band: FreshnessBand; ageHours: number | null; policy: FreshnessPolicy }> {
  const policy =
    freshnessPolicies[policyKey] ?? freshnessPolicies["booking:default"];
  if (!observedAt || !Number.isFinite(Date.parse(observedAt)))
    return { band: "unknown", ageHours: null, policy };
  const ageHours = Math.max(0, (now.getTime() - Date.parse(observedAt)) / 3_600_000);
  const band =
    ageHours <= policy.currentHours
      ? "current"
      : ageHours <= policy.agingHours
        ? "aging"
        : ageHours <= policy.staleHours
          ? "stale"
          : "expired";
  return { band, ageHours, policy };
}

export function evaluateCompleteness(
  values: Readonly<Record<string, KnownValue<unknown>>>,
  profileId: CompletenessProfileId,
): Readonly<{
  status: OperationalDataQualityStatus;
  mandatoryGaps: readonly string[];
  recommendedGaps: readonly string[];
}> {
  const profile = completenessProfiles[profileId];
  const missing = (field: string) => !values[field] || values[field].state !== "known";
  const mandatoryGaps = profile.mandatory.filter(missing);
  const recommendedGaps = profile.recommended.filter(missing);
  return {
    status: mandatoryGaps.length
      ? "unusable"
      : recommendedGaps.length
        ? "usable-with-gaps"
        : "trusted",
    mandatoryGaps,
    recommendedGaps,
  };
}

export type BookingQualityInput = Readonly<{
  workspaceId: string | null;
  bookingId: string;
  propertyId: string | null;
  propertyWorkspaceId: string | null;
  arrival: string | null;
  departure: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled" | null;
  stayStage?: string | null;
  observedAt: string | null;
  provider: string | null;
  externalReservationId: string | null;
  guestId?: string | null;
  guestIdentityStatus?: string | null;
  contactAvailable?: boolean | null;
  partyInconsistent?: boolean;
  partyTotal?: KnownValue<number>;
  propertyTimezoneConfidence?: "high" | "reduced";
  currency?: KnownValue<string>;
  revenue?: KnownValue<number>;
  profile?: CompletenessProfileId;
  urgency?: "arriving-today" | "in-stay" | "default" | "historical-report";
  providerReferenceDuplicate?: boolean;
  potentialDuplicate?: boolean;
  providerConnected?: boolean;
  mappingVersion?: string | null;
}>;

function dimension(
  status: OperationalDataQualityStatus,
  evidence: readonly string[],
  impact: string,
  action: string | null,
): QualityDimensionResult {
  return { status, evidence, impact, action };
}

function issue(
  code: DataQualityIssueCode,
  scope: DataQualityScope,
  observedAt: string,
  statement: string,
): DataQualityIssue {
  return createQualityIssue(
    code,
    scope,
    [{ kind: "field", statement }],
    observedAt,
  );
}

export function evaluateBookingQuality(
  input: BookingQualityInput,
  now = new Date(),
): OperationalDataQuality {
  const evaluatedAt = now.toISOString();
  const scope: DataQualityScope = {
    workspaceId: input.workspaceId ?? "unresolved",
    recordType: "booking",
    recordId: input.bookingId,
  };
  const issues: DataQualityIssue[] = [];
  if (!input.propertyId)
    issues.push(issue("BOOKING_MISSING_PROPERTY", scope, evaluatedAt, "No canonical property is associated."));
  if (input.workspaceId && input.propertyWorkspaceId && input.workspaceId !== input.propertyWorkspaceId)
    issues.push(issue("PROPERTY_WORKSPACE_MISMATCH", scope, evaluatedAt, "The booking and property owners differ."));
  const validDates = Boolean(input.arrival && input.departure && input.arrival < input.departure);
  if (!validDates)
    issues.push(issue("BOOKING_INVALID_DATE_RANGE", scope, evaluatedAt, "Arrival does not precede departure."));
  if (input.status === "completed" && input.departure && input.departure > evaluatedAt.slice(0, 10))
    issues.push(issue("BOOKING_STATUS_DATE_CONFLICT", scope, evaluatedAt, "A completed reservation has a future departure."));
  if (input.status === "cancelled" && ["arriving-today", "in-stay", "departing-today"].includes(input.stayStage ?? ""))
    issues.push(issue("BOOKING_STATUS_DATE_CONFLICT", scope, evaluatedAt, "A cancelled reservation appears in an active stay stage."));
  if (!input.externalReservationId || !input.provider)
    issues.push(issue("PROVIDER_REFERENCE_MISSING", scope, evaluatedAt, "Stable provider provenance is incomplete."));
  if (!input.mappingVersion)
    issues.push(issue("PROVENANCE_INCOMPLETE", scope, evaluatedAt, "The transformation version is unavailable."));
  if (input.providerReferenceDuplicate)
    issues.push(issue("BOOKING_DUPLICATE_PROVIDER_REFERENCE", scope, evaluatedAt, "The provider reference occurs on multiple canonical records."));
  if (input.potentialDuplicate)
    issues.push(issue("BOOKING_POTENTIAL_DUPLICATE", scope, evaluatedAt, "Property, dates, guest, and source are similar."));
  if (input.guestIdentityStatus === "unidentified")
    issues.push(issue("RESERVATION_GUEST_MISSING", scope, evaluatedAt, "No usable primary guest identity exists."));
  if (input.guestIdentityStatus === "provisional")
    issues.push(issue("RESERVATION_GUEST_PROVISIONAL", scope, evaluatedAt, "The primary guest identity is provisional."));
  if (input.contactAvailable === false)
    issues.push(issue("RESERVATION_CONTACT_UNAVAILABLE", scope, evaluatedAt, "No direct or platform contact channel is available."));
  if (input.partyInconsistent)
    issues.push(issue("RESERVATION_PARTY_INCONSISTENT", scope, evaluatedAt, "Party components do not equal the provider total."));
  if (input.propertyTimezoneConfidence === "reduced")
    issues.push(issue("PROPERTY_TIMEZONE_MISSING", scope, evaluatedAt, "Stay timing uses a workspace or platform fallback."));
  if (input.providerConnected === false)
    issues.push(issue("SOURCE_DISCONNECTED", scope, evaluatedAt, "The source connection is disconnected."));

  const freshness = evaluateFreshness(
    input.observedAt,
    now,
    `booking:${input.urgency ?? "default"}`,
  );
  if (freshness.band === "stale" || freshness.band === "expired")
    issues.push(issue("BOOKING_STALE", scope, evaluatedAt, `Booking freshness is ${freshness.band}.`));
  const values: Record<string, KnownValue<unknown>> = {
    bookingId: { state: "known", value: input.bookingId },
    workspaceId: input.workspaceId ? { state: "known", value: input.workspaceId } : { state: "unknown" },
    propertyId: input.propertyId ? { state: "known", value: input.propertyId } : { state: "unknown" },
    arrival: input.arrival ? { state: "known", value: input.arrival } : { state: "unknown" },
    departure: input.departure ? { state: "known", value: input.departure } : { state: "unknown" },
    status: input.status ? { state: "known", value: input.status } : { state: "unknown" },
    providerReference: input.externalReservationId ? { state: "known", value: input.externalReservationId } : { state: "not-synchronized" },
    guestId: input.guestId ? { state: "known", value: input.guestId } : { state: "unknown" },
    partyTotal: input.partyTotal ?? { state: "unknown" },
    contact: input.contactAvailable === true ? { state: "known", value: true } : { state: "unavailable" },
    currency: input.currency ?? { state: "not-applicable" },
    revenue: input.revenue ?? { state: "not-applicable" },
    stayStage: input.stayStage ? { state: "known", value: input.stayStage } : { state: "unknown" },
  };
  const completeness = evaluateCompleteness(values, input.profile ?? "booking-detail");
  const criticalConsistency = issues.some(({ code }) =>
    ["BOOKING_MISSING_PROPERTY", "BOOKING_INVALID_DATE_RANGE", "PROPERTY_WORKSPACE_MISMATCH", "PROVIDER_RECORD_CONFLICT"].includes(code),
  );
  const attentionConsistency = issues.some(({ code }) =>
    [
      "BOOKING_STATUS_DATE_CONFLICT",
      "RESERVATION_PARTY_INCONSISTENT",
      "PROPERTY_TIMEZONE_MISSING",
    ].includes(code),
  );
  const dimensions: Record<QualityDimension, QualityDimensionResult> = {
    freshness: dimension(
      freshness.band === "current" ? "trusted" : freshness.band === "aging" ? "usable-with-gaps" : freshness.band === "unknown" ? "unknown" : freshness.band === "stale" ? "degraded" : "unusable",
      [`Last successful observation: ${input.observedAt ?? "unknown"}`, `Freshness band: ${freshness.band}`],
      freshness.band === "current" ? "Reservation timing is current for this use." : "Recent source changes may be missing.",
      freshness.band === "current" ? null : "Synchronize the connected source.",
    ),
    completeness: dimension(completeness.status, [...completeness.mandatoryGaps, ...completeness.recommendedGaps], completeness.mandatoryGaps.length ? "Required operational context is missing." : completeness.recommendedGaps.length ? "The record remains usable with optional gaps." : "Required and recommended context is available.", completeness.mandatoryGaps.length ? "Restore required source fields." : null),
    consistency: dimension(criticalConsistency ? "unusable" : attentionConsistency ? "attention-needed" : "trusted", issues.filter(({ code }) => code.includes("CONFLICT") || code.includes("INCONSISTENT") || code.includes("INVALID") || code === "PROPERTY_TIMEZONE_MISSING").map(({ code }) => code), criticalConsistency ? "Related operational facts cannot be reconciled safely." : attentionConsistency ? "A relationship or timing input needs attention." : "No blocking relationship conflict was detected.", criticalConsistency || attentionConsistency ? "Review the source record." : null),
    uniqueness: dimension(input.providerReferenceDuplicate ? "unusable" : input.potentialDuplicate ? "attention-needed" : "trusted", input.providerReferenceDuplicate ? ["Confirmed duplicate provider reference"] : input.potentialDuplicate ? ["Similarity signal requires review"] : ["Canonical provider identity is unique"], input.providerReferenceDuplicate ? "Duplicate identity prevents safe operation." : input.potentialDuplicate ? "Both stays remain visible pending review." : "No duplicate signal was detected.", input.providerReferenceDuplicate || input.potentialDuplicate ? "Review duplicate candidates without deleting records." : null),
    provenance: dimension(!input.provider || !input.externalReservationId ? "attention-needed" : !input.mappingVersion ? "usable-with-gaps" : "trusted", [input.provider ?? "Provider unknown", input.externalReservationId ? "External reservation reference retained" : "External reservation reference missing", input.mappingVersion ?? "Mapping version missing"], "Source traceability determines whether values can be explained.", !input.provider || !input.externalReservationId ? "Refresh provider provenance." : null),
  };
  const dimensionStatus = aggregateQualityStatus(dimensions);
  const status =
    issues.some(({ severity }) => severity === "critical")
      ? "unusable"
      : issues.some(({ severity }) => severity === "warning")
        ? ["degraded", "unusable"].includes(dimensionStatus)
          ? dimensionStatus
          : "attention-needed"
        : issues.some(({ severity }) => severity === "information") &&
            dimensionStatus === "trusted"
          ? "usable-with-gaps"
          : dimensionStatus;
  return {
    status,
    dimensions,
    issues,
    evaluatedAt,
    policyId: OPERATIONAL_DATA_QUALITY_POLICY.id,
    policyVersion: OPERATIONAL_DATA_QUALITY_POLICY.version,
  };
}

export type DuplicateCandidate = Readonly<{
  workspaceId: string;
  bookingId: string;
  provider: string | null;
  externalReservationId: string | null;
  propertyId: string | null;
  arrival: string | null;
  departure: string | null;
  normalizedGuestName: string | null;
  source: string | null;
}>;

export function detectPotentialDuplicates(records: readonly DuplicateCandidate[]) {
  const confirmed: [string, string][] = [];
  const possible: [string, string][] = [];
  for (let left = 0; left < records.length; left += 1) {
    for (let right = left + 1; right < records.length; right += 1) {
      const a = records[left];
      const b = records[right];
      if (a.workspaceId !== b.workspaceId) continue;
      if (a.provider && a.provider === b.provider && a.externalReservationId && a.externalReservationId === b.externalReservationId) {
        confirmed.push([a.bookingId, b.bookingId]);
      } else if (
        a.propertyId &&
        a.propertyId === b.propertyId &&
        a.arrival === b.arrival &&
        a.departure === b.departure &&
        a.normalizedGuestName &&
        a.normalizedGuestName === b.normalizedGuestName &&
        a.source === b.source
      ) {
        possible.push([a.bookingId, b.bookingId]);
      }
    }
  }
  return { confirmed, possible };
}

export type MaterialObservation<T> = Readonly<{
  value: T;
  sourceType: "provider" | "user" | "platform-derived" | "system-default";
  authority: number;
  observedAt: string;
  reference: string;
}>;

export function detectConflicts<T>(
  observations: readonly MaterialObservation<T>[],
): Readonly<{
  conflicted: boolean;
  chosen: MaterialObservation<T> | null;
  rejected: readonly MaterialObservation<T>[];
  policy: string;
}> {
  if (!observations.length)
    return { conflicted: false, chosen: null, rejected: [], policy: "no-observation" };
  const ranked = [...observations].sort((left, right) => {
    if (left.sourceType === "user" && right.sourceType !== "user") return -1;
    if (right.sourceType === "user" && left.sourceType !== "user") return 1;
    return right.authority - left.authority || Date.parse(right.observedAt) - Date.parse(left.observedAt);
  });
  const chosen = ranked[0];
  return {
    conflicted: ranked.some(({ value }) => !Object.is(value, chosen.value)),
    chosen,
    rejected: ranked.slice(1),
    policy: chosen.sourceType === "user" ? "explicit-user-override" : "authority-then-recency",
  };
}

export function mapSynchronizationRun(input: Readonly<{
  status: "running" | "completed" | "failed" | "partial" | "skipped" | null;
  processed: number;
  failed: number;
}>): SynchronizationRunStatus {
  if (input.status === null) return "never-run";
  if (input.status === "running") return "in-progress";
  if (input.status === "skipped") return "skipped";
  if (input.status === "failed" || (input.processed === 0 && input.failed > 0)) return "failed";
  if (input.status === "partial" || input.failed > 0) return "partially-succeeded";
  return "succeeded";
}

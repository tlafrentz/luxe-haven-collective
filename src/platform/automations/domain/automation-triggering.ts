import { AutomationFoundationError, type AutomationDefinition, type AutomationDefinitionVersion } from "./automation-definition";

export const AUTOMATION_TRIGGER_KINDS = ["SCHEDULE_CALENDAR", "SCHEDULE_INTERVAL", "DOMAIN_EVENT", "STATE_CHANGE", "THRESHOLD", "MANUAL"] as const;
export type CanonicalAutomationTriggerKind = (typeof AUTOMATION_TRIGGER_KINDS)[number];
export type TriggerMisfirePolicy = "SKIP" | "FIRE_ONCE_NOW" | "BACKFILL_BOUNDED";
export type TriggerRepeatPolicy = "EDGE" | "LEVEL_WITH_COOLDOWN" | "ONE_SHOT";
export type TriggerDisposition = "DETECTED" | "VALIDATED" | "INELIGIBLE" | "DUPLICATE" | "DEFERRED" | "ACCEPTED" | "RUN_REQUEST_CREATED" | "MISSED" | "BACKFILLED" | "EXPIRED" | "FAILED_SAFE";
export type RunRequestStatus = "REQUESTED" | "WITHHELD" | "CANCELLED_BEFORE_DISPATCH";

export type TriggerScope = Readonly<{ type: "property" | "selected-properties" | "portfolio" | "organization"; propertyIds: readonly string[]; targetId?: string }>;
export type CalendarSchedule = Readonly<{
  cadence: "DAILY" | "SELECTED_WEEKDAYS" | "DAYS_OF_MONTH" | "MONTHLY";
  localTime: string;
  timeZone: string;
  weekdays?: readonly number[];
  daysOfMonth?: readonly number[];
  monthlyDay?: number;
  invalidDayPolicy?: "SKIP" | "LAST_DAY";
  ambiguousTimePolicy?: "EARLIER" | "LATER";
}>;
export type IntervalSchedule = Readonly<{ anchor: string; intervalUnit: "MINUTE" | "HOUR" | "DAY" | "WEEK"; intervalValue: number }>;
export type StateChangeSpecification = Readonly<{ field: string; operator: "FROM_TO" | "ENTER_SET" | "EXIT_SET" | "ANY_CHANGE"; from?: readonly string[]; to?: readonly string[]; allowInitialEntry: boolean }>;
export type ThresholdSpecification = Readonly<{
  metricId: string; metricVersion: string; unit: string;
  operator: "ABOVE" | "AT_OR_ABOVE" | "BELOW" | "AT_OR_BELOW" | "INSIDE_RANGE" | "OUTSIDE_RANGE" | "CROSSING_INTO" | "CROSSING_OUT_OF";
  value?: number; minimum?: number; maximum?: number; freshnessMs: number;
  repeat: TriggerRepeatPolicy; cooldownMs?: number; missingDataPolicy: "DEFER" | "INELIGIBLE";
}>;

export type AutomationTriggerDefinition = Readonly<{
  id: string; automationId: string; automationDefinitionVersion: number; tenantId: string;
  kind: CanonicalAutomationTriggerKind; schemaVersion: "au001-trigger.v1"; scope: TriggerScope;
  enabled: boolean; effectiveFrom: string; effectiveUntil?: string;
  configuration: CalendarSchedule | IntervalSchedule | StateChangeSpecification | ThresholdSpecification | Readonly<Record<string, unknown>>;
  misfirePolicy: TriggerMisfirePolicy; backfillPolicy: Readonly<{ maximumCount: number; maximumAgeMs: number }>;
  deduplicationPolicyVersion: "au001-occurrence.v1"; eligibilityPolicyVersion: "au001-eligibility.v1";
  createdBy: string; updatedBy: string; createdAt: string; updatedAt: string; version: number;
}>;

export type ScheduleOccurrenceSlot = Readonly<{
  slotKey: string; occurredAt: string; localDateTime: string; timeZone: string; utcOffsetMinutes: number;
  adjustment: "NONE" | "DST_GAP_ADVANCED" | "DST_OVERLAP_EARLIER" | "DST_OVERLAP_LATER";
  timePolicyVersion: "au001-time.v1";
}>;
export type CanonicalDomainEvent = Readonly<{
  id: string; eventType: string; schemaVersion: string; tenantId: string; sourceCapability: string;
  sourceAggregateId?: string; sourceAggregateVersion?: number; occurredAt: string; recordedAt: string;
  correlationId: string; causationId?: string; causationDepth: number; propertyIds: readonly string[];
  payloadReference?: string; safePayload: Readonly<Record<string, string | number | boolean | null>>;
  authenticity: "verified" | "trusted-internal";
}>;
export type TriggerOccurrence = Readonly<{
  id: string; occurrenceKey: string; tenantId: string; automationId: string; automationDefinitionVersion: number;
  triggerId: string; triggerKind: CanonicalAutomationTriggerKind; targetKey: string; occurredAt: string; detectedAt: string;
  disposition: TriggerDisposition; reasonCode: string; correlationId: string; causationId?: string;
  sourceIdentity: string; safeContext: Readonly<Record<string, string | number | boolean | null>>;
  eligibilityPolicyVersion: string; backfilled: boolean; version: number;
}>;
export type AutomationRunRequest = Readonly<{
  id: string; idempotencyKey: string; tenantId: string; scope: TriggerScope; automationId: string;
  automationDefinitionVersion: number; triggerId: string; triggerKind: CanonicalAutomationTriggerKind; occurrenceId: string;
  requestedAt: string; occurredAt: string; eligibilityPolicyVersion: string; approvalClassification: string;
  correlationId: string; causationId?: string; safeTriggerContext: Readonly<Record<string, string | number | boolean | null>>;
  status: RunRequestStatus; version: number;
}>;

export type TriggerFailureCode =
  | "AUTOMATION_NOT_FOUND" | "AUTOMATION_ACCESS_DENIED" | "AUTOMATION_VERSION_CONFLICT" | "AUTOMATION_VERSION_INCOMPATIBLE" | "AUTOMATION_NOT_ACTIVE"
  | "TRIGGER_NOT_FOUND" | "TRIGGER_ACCESS_DENIED" | "TRIGGER_KIND_UNSUPPORTED" | "TRIGGER_CONFIGURATION_INVALID" | "TRIGGER_TIME_ZONE_INVALID"
  | "TRIGGER_SCHEDULE_INVALID" | "TRIGGER_EFFECTIVE_WINDOW_CLOSED" | "TRIGGER_SOURCE_NOT_FOUND" | "TRIGGER_SOURCE_ACCESS_DENIED"
  | "TRIGGER_SOURCE_VERSION_CONFLICT" | "TRIGGER_SOURCE_CONTEXT_INSUFFICIENT" | "TRIGGER_SOURCE_STALE" | "TRIGGER_EVENT_INVALID"
  | "TRIGGER_EVENT_SCHEMA_UNSUPPORTED" | "TRIGGER_EVENT_AUTHENTICITY_INVALID" | "TRIGGER_EVENT_TOO_LATE" | "TRIGGER_EVENT_REPLAY_NOT_ALLOWED"
  | "TRIGGER_CONDITION_NOT_MET" | "TRIGGER_OCCURRENCE_DUPLICATE" | "TRIGGER_OCCURRENCE_EXPIRED" | "TRIGGER_COOLDOWN_ACTIVE"
  | "TRIGGER_FANOUT_LIMIT_EXCEEDED" | "TRIGGER_RECURSION_LIMIT_EXCEEDED" | "TRIGGER_CYCLE_DETECTED" | "TRIGGER_MANUAL_REQUEST_UNAUTHORIZED"
  | "TRIGGER_IDEMPOTENCY_CONFLICT" | "SCHEDULER_LEASE_UNAVAILABLE" | "SCHEDULER_LEASE_LOST" | "SCHEDULER_CHECKPOINT_CONFLICT"
  | "SCHEDULER_CHECKPOINT_INVALID" | "SCHEDULER_DEGRADED" | "BACKFILL_NOT_ALLOWED" | "BACKFILL_RANGE_INVALID" | "BACKFILL_LIMIT_EXCEEDED"
  | "RUN_REQUEST_CREATION_FAILED" | "PROPERTY_ACCESS_DENIED" | "CONCURRENT_MODIFICATION";

export const AutomationTriggerError = AutomationFoundationError;

export function validateTriggerDefinition(trigger: AutomationTriggerDefinition): AutomationTriggerDefinition {
  required(trigger.id, "Trigger ID"); required(trigger.automationId, "Automation ID"); required(trigger.tenantId, "Tenant ID");
  if (!AUTOMATION_TRIGGER_KINDS.includes(trigger.kind)) fail("TRIGGER_KIND_UNSUPPORTED", "The trigger kind is unsupported.");
  if (trigger.schemaVersion !== "au001-trigger.v1") fail("TRIGGER_CONFIGURATION_INVALID", "The trigger schema is unsupported.");
  if (!positive(trigger.automationDefinitionVersion) || !positive(trigger.version)) fail("TRIGGER_CONFIGURATION_INVALID", "Trigger versions must be positive integers.");
  if (!instant(trigger.effectiveFrom) || trigger.effectiveUntil && (!instant(trigger.effectiveUntil) || Date.parse(trigger.effectiveUntil) <= Date.parse(trigger.effectiveFrom))) fail("TRIGGER_EFFECTIVE_WINDOW_CLOSED", "The trigger effective window is invalid.");
  validateScope(trigger.scope);
  if (!positive(trigger.backfillPolicy.maximumCount) || trigger.backfillPolicy.maximumCount > 500 || !positive(trigger.backfillPolicy.maximumAgeMs)) fail("BACKFILL_LIMIT_EXCEEDED", "Backfill limits are invalid.");
  if (trigger.kind === "SCHEDULE_CALENDAR") validateCalendarSchedule(trigger.configuration as CalendarSchedule);
  if (trigger.kind === "SCHEDULE_INTERVAL") validateIntervalSchedule(trigger.configuration as IntervalSchedule);
  if (trigger.kind === "THRESHOLD") validateThresholdSpecification(trigger.configuration as ThresholdSpecification);
  return deepFreeze(trigger);
}

export function calculateScheduleOccurrences(input: Readonly<{ trigger: AutomationTriggerDefinition; from: string; through: string; maximumCount: number }>): readonly ScheduleOccurrenceSlot[] {
  const trigger = validateTriggerDefinition(input.trigger);
  if (!instant(input.from) || !instant(input.through) || Date.parse(input.through) < Date.parse(input.from)) fail("TRIGGER_SCHEDULE_INVALID", "The schedule scan window is invalid.");
  if (!positive(input.maximumCount) || input.maximumCount > 1000) fail("BACKFILL_LIMIT_EXCEEDED", "The schedule scan limit is invalid.");
  if (trigger.kind === "SCHEDULE_INTERVAL") return intervalOccurrences(trigger, input.from, input.through, input.maximumCount);
  if (trigger.kind !== "SCHEDULE_CALENDAR") fail("TRIGGER_KIND_UNSUPPORTED", "Only schedule triggers can calculate schedule occurrences.");
  const schedule = trigger.configuration as CalendarSchedule;
  const start = new Date(Math.max(Date.parse(input.from), Date.parse(trigger.effectiveFrom)));
  const endMs = Math.min(Date.parse(input.through), trigger.effectiveUntil ? Date.parse(trigger.effectiveUntil) : Number.POSITIVE_INFINITY);
  if (start.getTime() > endMs) return Object.freeze([]);
  const startLocal = localParts(start, schedule.timeZone);
  const endLocal = localParts(new Date(endMs), schedule.timeZone);
  const cursor = new Date(Date.UTC(startLocal.year, startLocal.month - 1, startLocal.day));
  const endDate = Date.UTC(endLocal.year, endLocal.month - 1, endLocal.day);
  const results: ScheduleOccurrenceSlot[] = [];
  for (; cursor.getTime() <= endDate && results.length < input.maximumCount; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth() + 1, day = cursor.getUTCDate();
    if (!calendarMatches(schedule, year, month, day)) continue;
    const [hour, minute] = schedule.localTime.split(":").map(Number);
    const slot = resolveLocalDateTime({ year, month, day, hour, minute, timeZone: schedule.timeZone, ambiguous: schedule.ambiguousTimePolicy ?? "EARLIER" });
    const at = Date.parse(slot.occurredAt);
    if (at >= start.getTime() && at <= endMs) results.push(slot);
  }
  return Object.freeze(results);
}

export function occurrenceIdentity(input: Readonly<{ tenantId: string; automationId: string; automationDefinitionVersion: number; triggerId: string; triggerKind: CanonicalAutomationTriggerKind; sourceIdentity: string; targetKey?: string; eligibilityPolicyVersion: string }>): string {
  const parts = ["auocc-v1", input.tenantId, input.automationId, String(input.automationDefinitionVersion), input.triggerId, input.triggerKind, input.sourceIdentity, input.targetKey ?? "global", input.eligibilityPolicyVersion];
  if (parts.some((part) => !part.trim())) fail("TRIGGER_CONFIGURATION_INVALID", "Occurrence identity inputs are incomplete.");
  return parts.map((part) => encodeURIComponent(part)).join(":");
}

export function validateDomainEvent(event: CanonicalDomainEvent, input: Readonly<{ expectedTenantId: string; acceptedSchemaVersions: readonly string[]; maximumPayloadBytes: number; maximumLatenessMs: number; now: string }>): CanonicalDomainEvent {
  required(event.id, "Event ID"); required(event.eventType, "Event type"); required(event.sourceCapability, "Source capability");
  if (event.tenantId !== input.expectedTenantId) fail("TRIGGER_SOURCE_ACCESS_DENIED", "The event tenant does not match the automation tenant.");
  if (!input.acceptedSchemaVersions.includes(event.schemaVersion)) fail("TRIGGER_EVENT_SCHEMA_UNSUPPORTED", "The event schema is unsupported.");
  if (!instant(event.occurredAt) || !instant(event.recordedAt) || !instant(input.now)) fail("TRIGGER_EVENT_INVALID", "The event timestamps are invalid.");
  if (event.authenticity !== "verified" && event.authenticity !== "trusted-internal") fail("TRIGGER_EVENT_AUTHENTICITY_INVALID", "Event authenticity could not be verified.");
  if (Date.parse(input.now) - Date.parse(event.occurredAt) > input.maximumLatenessMs) fail("TRIGGER_EVENT_TOO_LATE", "The event arrived outside the supported lateness window.");
  if (!Number.isSafeInteger(event.causationDepth) || event.causationDepth < 0) fail("TRIGGER_EVENT_INVALID", "The causation depth is invalid.");
  if (new TextEncoder().encode(JSON.stringify(event.safePayload)).length > input.maximumPayloadBytes) fail("TRIGGER_EVENT_INVALID", "The event payload exceeds its safe bound.");
  return deepFreeze(event);
}

export function evaluateStateChange(specification: StateChangeSpecification, input: Readonly<{ previous?: string; current: string; previousVersion?: number; currentVersion: number }>): Readonly<{ matched: boolean; reasonCode: string }> {
  if (!input.current.trim() || !positive(input.currentVersion)) fail("TRIGGER_SOURCE_CONTEXT_INSUFFICIENT", "Current state and version are required.");
  if (input.previousVersion !== undefined && input.previousVersion >= input.currentVersion) fail("TRIGGER_SOURCE_VERSION_CONFLICT", "The state versions are not monotonic.");
  if (input.previous === undefined && !specification.allowInitialEntry) return Object.freeze({ matched: false, reasonCode: "INITIAL_STATE_SUPPRESSED" });
  const previous = input.previous;
  const matched = specification.operator === "ANY_CHANGE" ? previous !== undefined && previous !== input.current
    : specification.operator === "FROM_TO" ? previous !== undefined && (specification.from ?? []).includes(previous) && (specification.to ?? []).includes(input.current)
    : specification.operator === "ENTER_SET" ? (previous === undefined || !(specification.to ?? []).includes(previous)) && (specification.to ?? []).includes(input.current)
    : previous !== undefined && (specification.from ?? []).includes(previous) && !(specification.from ?? []).includes(input.current);
  return Object.freeze({ matched, reasonCode: matched ? "STATE_TRANSITION_MATCHED" : "TRIGGER_CONDITION_NOT_MET" });
}

export function evaluateThreshold(specification: ThresholdSpecification, input: Readonly<{ previous?: number; current?: number; unit: string; observedAt: string; now: string; lastAcceptedAt?: string; armed: boolean }>): Readonly<{ matched: boolean; armed: boolean; reasonCode: string }> {
  validateThresholdSpecification(specification);
  if (input.unit !== specification.unit) fail("TRIGGER_CONFIGURATION_INVALID", "The metric unit is incompatible with the threshold.");
  if (input.current === undefined || !Number.isFinite(input.current)) return Object.freeze({ matched: false, armed: input.armed, reasonCode: specification.missingDataPolicy === "DEFER" ? "TRIGGER_SOURCE_CONTEXT_INSUFFICIENT" : "TRIGGER_CONDITION_NOT_MET" });
  if (!instant(input.observedAt) || !instant(input.now) || Date.parse(input.now) - Date.parse(input.observedAt) > specification.freshnessMs) fail("TRIGGER_SOURCE_STALE", "The source observation is stale.");
  const currentTrue = thresholdTrue(specification, input.current), previousTrue = input.previous === undefined ? false : thresholdTrue(specification, input.previous);
  const edge = specification.operator === "CROSSING_INTO" ? !previousTrue && currentTrue : specification.operator === "CROSSING_OUT_OF" ? previousTrue && !currentTrue : !previousTrue && currentTrue;
  if (!currentTrue && specification.operator !== "CROSSING_OUT_OF") return Object.freeze({ matched: false, armed: true, reasonCode: "THRESHOLD_REARMED" });
  if (specification.repeat === "ONE_SHOT" && !input.armed) return Object.freeze({ matched: false, armed: false, reasonCode: "ONE_SHOT_SUPPRESSED" });
  if (specification.repeat === "EDGE" && !edge) return Object.freeze({ matched: false, armed: !currentTrue, reasonCode: "TRIGGER_CONDITION_NOT_MET" });
  if (specification.repeat === "LEVEL_WITH_COOLDOWN" && input.lastAcceptedAt && Date.parse(input.now) - Date.parse(input.lastAcceptedAt) < (specification.cooldownMs ?? 0)) return Object.freeze({ matched: false, armed: input.armed, reasonCode: "TRIGGER_COOLDOWN_ACTIVE" });
  const matched = specification.operator === "CROSSING_OUT_OF" ? edge : currentTrue;
  return Object.freeze({ matched, armed: matched ? false : input.armed, reasonCode: matched ? "THRESHOLD_MATCHED" : "TRIGGER_CONDITION_NOT_MET" });
}

export function evaluateTriggerEligibility(input: Readonly<{ definition: AutomationDefinition; version: AutomationDefinitionVersion; trigger: AutomationTriggerDefinition; occurredAt: string; sourceAuthorized: boolean; sourceCurrent: boolean; conditionMatched: boolean; recursionDepth: number; maximumRecursionDepth: number; cycleDetected: boolean; fanOutCount: number; maximumFanOut: number }>): Readonly<{ eligible: boolean; reasonCode: string }> {
  if (input.definition.id !== input.trigger.automationId || input.definition.tenantId !== input.trigger.tenantId || input.version.version !== input.trigger.automationDefinitionVersion) return Object.freeze({ eligible: false, reasonCode: "AUTOMATION_VERSION_CONFLICT" });
  if (input.version.compatibility !== "compatible") return Object.freeze({ eligible: false, reasonCode: "AUTOMATION_VERSION_INCOMPATIBLE" });
  if (input.definition.status !== "active" || !input.trigger.enabled) return Object.freeze({ eligible: false, reasonCode: "AUTOMATION_NOT_ACTIVE" });
  const at = Date.parse(input.occurredAt);
  if (!Number.isFinite(at) || at < Date.parse(input.trigger.effectiveFrom) || input.trigger.effectiveUntil && at > Date.parse(input.trigger.effectiveUntil)) return Object.freeze({ eligible: false, reasonCode: "TRIGGER_EFFECTIVE_WINDOW_CLOSED" });
  if (!input.sourceAuthorized) return Object.freeze({ eligible: false, reasonCode: "TRIGGER_SOURCE_ACCESS_DENIED" });
  if (!input.sourceCurrent) return Object.freeze({ eligible: false, reasonCode: "TRIGGER_SOURCE_STALE" });
  if (!input.conditionMatched) return Object.freeze({ eligible: false, reasonCode: "TRIGGER_CONDITION_NOT_MET" });
  if (input.cycleDetected) return Object.freeze({ eligible: false, reasonCode: "TRIGGER_CYCLE_DETECTED" });
  if (input.recursionDepth > input.maximumRecursionDepth) return Object.freeze({ eligible: false, reasonCode: "TRIGGER_RECURSION_LIMIT_EXCEEDED" });
  if (input.fanOutCount >= input.maximumFanOut) return Object.freeze({ eligible: false, reasonCode: "TRIGGER_FANOUT_LIMIT_EXCEEDED" });
  return Object.freeze({ eligible: true, reasonCode: "TRIGGER_ELIGIBLE" });
}

function intervalOccurrences(trigger: AutomationTriggerDefinition, from: string, through: string, maximumCount: number): readonly ScheduleOccurrenceSlot[] {
  const schedule = trigger.configuration as IntervalSchedule, interval = intervalMilliseconds(schedule), anchor = Date.parse(schedule.anchor);
  const startMs = Math.max(Date.parse(from), Date.parse(trigger.effectiveFrom)), endMs = Math.min(Date.parse(through), trigger.effectiveUntil ? Date.parse(trigger.effectiveUntil) : Infinity);
  const firstIndex = Math.max(0, Math.ceil((startMs - anchor) / interval)); const output: ScheduleOccurrenceSlot[] = [];
  for (let index = firstIndex; output.length < maximumCount; index += 1) {
    const at = anchor + index * interval; if (at > endMs) break;
    const occurredAt = new Date(at).toISOString(); output.push(Object.freeze({ slotKey: `interval:${schedule.anchor}:${interval}:${index}`, occurredAt, localDateTime: occurredAt, timeZone: "UTC", utcOffsetMinutes: 0, adjustment: "NONE", timePolicyVersion: "au001-time.v1" }));
  }
  return Object.freeze(output);
}

function resolveLocalDateTime(input: Readonly<{ year: number; month: number; day: number; hour: number; minute: number; timeZone: string; ambiguous: "EARLIER" | "LATER" }>): ScheduleOccurrenceSlot {
  assertTimeZone(input.timeZone); const expected = localNumber(input); const naive = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute);
  const matches: number[] = []; let firstAfter: number | undefined;
  for (let instantMs = naive - 18 * 3_600_000; instantMs <= naive + 18 * 3_600_000; instantMs += 60_000) {
    const parts = localParts(new Date(instantMs), input.timeZone), value = localNumber(parts);
    if (value === expected) matches.push(instantMs);
    if (value > expected && firstAfter === undefined) firstAfter = instantMs;
  }
  const selected = matches.length ? (input.ambiguous === "LATER" ? matches.at(-1)! : matches[0]) : firstAfter;
  if (selected === undefined) fail("TRIGGER_SCHEDULE_INVALID", "The local schedule slot could not be resolved.");
  const actual = localParts(new Date(selected), input.timeZone), offset = Math.round((Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute) - selected) / 60_000);
  const adjustment = matches.length > 1 ? (input.ambiguous === "LATER" ? "DST_OVERLAP_LATER" : "DST_OVERLAP_EARLIER") : matches.length === 0 ? "DST_GAP_ADVANCED" : "NONE";
  const localDateTime = `${pad(actual.year, 4)}-${pad(actual.month)}-${pad(actual.day)}T${pad(actual.hour)}:${pad(actual.minute)}`;
  return Object.freeze({ slotKey: `calendar:${input.timeZone}:${pad(input.year, 4)}-${pad(input.month)}-${pad(input.day)}T${pad(input.hour)}:${pad(input.minute)}`, occurredAt: new Date(selected).toISOString(), localDateTime, timeZone: input.timeZone, utcOffsetMinutes: offset, adjustment, timePolicyVersion: "au001-time.v1" });
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}
function localNumber(value: Readonly<{ year: number; month: number; day: number; hour: number; minute: number }>) { return value.year * 100_000_000 + value.month * 1_000_000 + value.day * 10_000 + value.hour * 100 + value.minute; }
function calendarMatches(schedule: CalendarSchedule, year: number, month: number, day: number) {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (schedule.cadence === "DAILY") return true;
  if (schedule.cadence === "SELECTED_WEEKDAYS") return (schedule.weekdays ?? []).includes(weekday);
  const configured = schedule.cadence === "MONTHLY" ? [schedule.monthlyDay ?? 1] : schedule.daysOfMonth ?? [];
  return configured.some((candidate) => candidate === day || candidate > lastDay && schedule.invalidDayPolicy === "LAST_DAY" && day === lastDay);
}
function validateCalendarSchedule(schedule: CalendarSchedule) {
  assertTimeZone(schedule.timeZone);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.localTime)) fail("TRIGGER_SCHEDULE_INVALID", "Calendar time must use HH:mm.");
  if (schedule.cadence === "SELECTED_WEEKDAYS" && (!(schedule.weekdays?.length) || schedule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) fail("TRIGGER_SCHEDULE_INVALID", "Selected weekdays are invalid.");
  const days = schedule.cadence === "MONTHLY" ? [schedule.monthlyDay] : schedule.cadence === "DAYS_OF_MONTH" ? schedule.daysOfMonth : undefined;
  if (days && (!days.length || days.some((day) => !day || !Number.isInteger(day) || day < 1 || day > 31))) fail("TRIGGER_SCHEDULE_INVALID", "Calendar days are invalid.");
}
function validateIntervalSchedule(schedule: IntervalSchedule) { if (!instant(schedule.anchor) || !positive(schedule.intervalValue) || schedule.intervalValue > 10_000) fail("TRIGGER_SCHEDULE_INVALID", "The interval schedule is invalid."); intervalMilliseconds(schedule); }
function intervalMilliseconds(schedule: IntervalSchedule) { const unit = { MINUTE: 60_000, HOUR: 3_600_000, DAY: 86_400_000, WEEK: 604_800_000 }[schedule.intervalUnit]; if (!unit) fail("TRIGGER_SCHEDULE_INVALID", "The interval unit is invalid."); return unit * schedule.intervalValue; }
function validateThresholdSpecification(specification: ThresholdSpecification) {
  required(specification.metricId, "Metric ID"); required(specification.metricVersion, "Metric version"); required(specification.unit, "Metric unit");
  if (!positive(specification.freshnessMs)) fail("TRIGGER_CONFIGURATION_INVALID", "Source freshness must be positive.");
  const range = ["INSIDE_RANGE", "OUTSIDE_RANGE", "CROSSING_INTO", "CROSSING_OUT_OF"].includes(specification.operator);
  if (range ? !Number.isFinite(specification.minimum) || !Number.isFinite(specification.maximum) || specification.minimum! > specification.maximum! : !Number.isFinite(specification.value)) fail("TRIGGER_CONFIGURATION_INVALID", "Threshold boundaries are invalid.");
  if (specification.repeat === "LEVEL_WITH_COOLDOWN" && !positive(specification.cooldownMs ?? 0)) fail("TRIGGER_CONFIGURATION_INVALID", "Level triggers require a positive cooldown.");
}
function thresholdTrue(specification: ThresholdSpecification, value: number) {
  if (specification.operator === "ABOVE") return value > specification.value!; if (specification.operator === "AT_OR_ABOVE") return value >= specification.value!;
  if (specification.operator === "BELOW") return value < specification.value!; if (specification.operator === "AT_OR_BELOW") return value <= specification.value!;
  const inside = value >= specification.minimum! && value <= specification.maximum!;
  return specification.operator === "OUTSIDE_RANGE" || specification.operator === "CROSSING_OUT_OF" ? !inside : inside;
}
function validateScope(scope: TriggerScope) { if (scope.type === "property" && scope.propertyIds.length !== 1 || scope.type === "selected-properties" && scope.propertyIds.length < 1) fail("TRIGGER_CONFIGURATION_INVALID", "The trigger scope is invalid."); }
function assertTimeZone(zone: string) { try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(); } catch { fail("TRIGGER_TIME_ZONE_INVALID", "The IANA time zone is invalid."); } }
function required(value: string, label: string) { if (!value?.trim()) fail("TRIGGER_CONFIGURATION_INVALID", `${label} is required.`); }
function positive(value: number) { return Number.isSafeInteger(value) && value > 0; }
function instant(value: string) { return Number.isFinite(Date.parse(value)); }
function pad(value: number, length = 2) { return String(value).padStart(length, "0"); }
function fail(code: TriggerFailureCode, message: string): never { throw new AutomationTriggerError(code, message); }
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }

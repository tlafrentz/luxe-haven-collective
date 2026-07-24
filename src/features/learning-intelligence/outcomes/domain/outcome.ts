import { OutcomeDomainError } from "./outcome-errors";
import {
  OUTCOME_LIMITS,
  type OutcomeAttribution,
  type OutcomeConfidence,
  type OutcomeEvidenceReference,
  type OutcomeExpectation,
  type OutcomeId,
  type OutcomeInconclusiveReason,
  type OutcomeLineage,
  type OutcomeMeasurement,
  type OutcomeMeasurementPlan,
  type OutcomeMeasurementWindowId,
  type OutcomeOwnerId,
  type OutcomePlanningMode,
  type OutcomeQualitativeObservation,
  type OutcomeState,
  type OutcomeStatus,
  type OutcomeSubject,
  type OutcomeOrigin,
  type OutcomeDataGap,
  type OutcomeEvent,
  type OutcomeValue,
  type OutcomeTarget,
} from "./outcome-model";

type MutationContext = Readonly<{ occurredAt: Date; idempotencyKey: string; eventId?: string }>;
export type PlanOutcomeInput = Readonly<{
  id: OutcomeId;
  ownerId: OutcomeOwnerId;
  subject: OutcomeSubject;
  origin: OutcomeOrigin;
  planningMode: OutcomePlanningMode;
  expectations: readonly OutcomeExpectation[];
  measurementPlan: OutcomeMeasurementPlan;
  confidence: OutcomeConfidence;
  lineage: OutcomeLineage;
  plannedAt: Date;
  idempotencyKey: string;
  eventId?: string;
}>;

const TERMINAL: readonly OutcomeStatus[] = ["closed", "inconclusive", "cancelled", "superseded"];

export class Outcome {
  private constructor(private state: OutcomeState) {}

  public static plan(input: PlanOutcomeInput): Outcome {
    date(input.plannedAt, "plannedAt");
    required(input.idempotencyKey, "idempotencyKey");
    validateOrigin(input.origin);
    validateSubject(input.subject);
    validateLineage(input.lineage);
    validatePlan(input.expectations, input.measurementPlan, input.planningMode, input.plannedAt);
    const attribution: OutcomeAttribution = Object.freeze({
      status: "not-assessed",
      basis: Object.freeze([]),
      competingFactors: Object.freeze([]),
      confidence: input.confidence.attributionQuality,
    });
    const state: OutcomeState = {
      id: input.id,
      ownerId: input.ownerId,
      subject: freezeSubject(input.subject),
      origin: Object.freeze({ ...input.origin }),
      planningMode: input.planningMode,
      status: "planned",
      expectations: Object.freeze(input.expectations.map(cloneExpectation)),
      measurementPlan: clonePlan(input.measurementPlan),
      measurements: Object.freeze([]),
      qualitativeObservations: Object.freeze([]),
      evidence: Object.freeze([]),
      attribution,
      confidence: input.confidence,
      lineage: cloneLineage(input.lineage),
      createdAt: new Date(input.plannedAt),
      updatedAt: new Date(input.plannedAt),
      version: 1,
      events: Object.freeze([]),
      acceptedIdempotencyKeys: Object.freeze([input.idempotencyKey]),
    };
    const outcome = new Outcome(state);
    outcome.state = {
      ...state,
      events: Object.freeze([outcome.event("OutcomePlanned", {
        originType: input.origin.type,
        planningMode: input.planningMode,
      }, { occurredAt: input.plannedAt, idempotencyKey: input.idempotencyKey, eventId: input.eventId }, 1)]),
    };
    return outcome;
  }

  public static restore(state: OutcomeState): Outcome {
    return new Outcome(cloneState(state));
  }

  public get id(): OutcomeId { return this.state.id; }
  public get ownerId(): OutcomeOwnerId { return this.state.ownerId; }
  public get version(): number { return this.state.version; }
  public get status(): OutcomeStatus { return this.state.status; }
  public get props(): OutcomeState { return cloneState(this.state); }

  public startMeasurement(context: MutationContext): void {
    if (this.idempotent(context)) return;
    this.transition("measuring", ["planned"]);
    const incomplete = this.state.lineage.executionReferences.some(reference => reference.completion === "not-started");
    if (incomplete) throw new OutcomeDomainError("OUTCOME_INVALID_TRANSITION", "Measurement cannot start before execution.", { from: "planned", to: "measuring" });
    const windows = this.state.measurementPlan.windows.map(window => {
      const active = window.status === "planned" && window.start.getTime() <= context.occurredAt.getTime() && context.occurredAt.getTime() <= window.end.getTime();
      return active ? Object.freeze({ ...window, status: "open" as const }) : window;
    });
    this.commit("measuring", "OutcomeMeasurementStarted", context, { startedAt: context.occurredAt.toISOString() }, {
      measurementPlan: Object.freeze({ ...this.state.measurementPlan, windows: Object.freeze(windows) }),
    });
  }

  public recordMeasurement(measurement: OutcomeMeasurement, context: MutationContext): void {
    if (this.idempotent(context)) return;
    this.assertStatus(["measuring"], "measuring");
    if (this.state.measurements.length >= OUTCOME_LIMITS.measurements) limit("measurements");
    if (this.state.measurements.some(value => value.id.equals(measurement.id))) duplicate("measurement", measurement.id.value);
    const window = this.state.measurementPlan.windows.find(value => value.id.equals(measurement.measurementWindowId));
    if (!window) invalid("OUTCOME_WINDOW_INVALID", "Measurement window does not exist.", measurement.measurementWindowId.value);
    const expectation = measurement.expectationId
      ? this.state.expectations.find(value => value.id.equals(measurement.expectationId!))
      : undefined;
    if (measurement.expectationId && !expectation) invalid("OUTCOME_MEASUREMENT_INVALID", "Measurement expectation does not exist.", measurement.expectationId.value);
    if (expectation && !sameMetric(expectation.metric, measurement.metric)) invalid("OUTCOME_MEASUREMENT_INVALID", "Measurement metric does not match its expectation.", measurement.id.value);
    validateValue(measurement.metric.kind, measurement.value, "measurement");
    if (expectation) validateCurrencyCompatibility(expectation, measurement.value);
    date(measurement.observedAt, "observedAt"); date(measurement.recordedAt, "recordedAt");
    const late = measurement.observedAt < window.start || measurement.observedAt > window.end || window.status === "closed";
    const policy = this.state.measurementPlan.completionPolicy.lateEvidencePolicy;
    if (late && policy === "reject") invalid("OUTCOME_MEASUREMENT_INVALID", "Late measurement is rejected by the plan.", measurement.id.value);
    if (measurement.supersedesMeasurementId && !this.state.measurements.some(value => value.id.equals(measurement.supersedesMeasurementId!))) {
      invalid("OUTCOME_MEASUREMENT_INVALID", "Superseded measurement does not exist.", measurement.supersedesMeasurementId.value);
    }
    const normalized = Object.freeze({
      ...measurement,
      status: late && policy === "accept-as-supplemental" ? "supplemental" as const : measurement.status,
      late,
      observedAt: new Date(measurement.observedAt),
      recordedAt: new Date(measurement.recordedAt),
    });
    this.commit("measuring", "OutcomeMeasurementRecorded", context, {
      measurementId: measurement.id.value, metricKey: measurement.metric.key.value,
      authoritative: normalized.status === "authoritative", late,
    }, { measurements: Object.freeze([...this.state.measurements, normalized]) });
  }

  public recordQualitativeObservation(observation: OutcomeQualitativeObservation, context: MutationContext): void {
    if (this.idempotent(context)) return;
    this.assertStatus(["measuring"], "measuring");
    if (this.state.qualitativeObservations.length >= OUTCOME_LIMITS.qualitativeObservations) limit("qualitative observations");
    if (this.state.qualitativeObservations.some(value => value.id.equals(observation.id))) duplicate("qualitative observation", observation.id.value);
    if (observation.expectationId && !this.state.expectations.some(value => value.id.equals(observation.expectationId!))) {
      invalid("OUTCOME_EXPECTATION_INVALID", "Qualitative observation expectation does not exist.", observation.expectationId.value);
    }
    this.commit("measuring", "OutcomeQualitativeObservationRecorded", context, {
      observationId: observation.id.value, category: observation.category,
    }, { qualitativeObservations: Object.freeze([...this.state.qualitativeObservations, cloneQualitative(observation)]) });
  }

  public attachEvidence(evidence: OutcomeEvidenceReference, context: MutationContext): void {
    if (this.idempotent(context)) return;
    this.assertMutable();
    if (this.state.evidence.some(value => value.id.equals(evidence.id))) {
      this.rememberIdempotency(context.idempotencyKey);
      return;
    }
    if (this.state.evidence.length >= OUTCOME_LIMITS.evidence) limit("evidence");
    required(evidence.sourceId, "evidence sourceId");
    this.commit(this.status, "OutcomeEvidenceAttached", context, {
      evidenceId: evidence.id.value, role: evidence.role, sourceId: evidence.sourceId,
    }, { evidence: Object.freeze([...this.state.evidence, cloneEvidence(evidence)]) });
  }

  public updateAttribution(attribution: OutcomeAttribution, context: MutationContext): void {
    if (this.idempotent(context)) return;
    this.assertStatus(["measuring", "measurement-complete"], this.status);
    if (attribution.competingFactors.length > OUTCOME_LIMITS.competingFactors) limit("competing factors");
    if (attribution.status === "established" && !attribution.basis.some(value => value.type === "controlled-comparison" || value.type === "mechanism-supported")) {
      invalid("OUTCOME_INPUT_INVALID", "Established attribution requires controlled-comparison or mechanism-supported evidence.");
    }
    if (attribution.status !== "not-assessed" && attribution.basis.length === 0) {
      invalid("OUTCOME_INPUT_INVALID", "Assessed attribution requires an explicit basis.");
    }
    this.commit(this.status, "OutcomeAttributionUpdated", context, { attributionStatus: attribution.status }, {
      attribution: cloneAttribution(attribution),
    });
  }

  public closeWindow(windowId: OutcomeMeasurementWindowId, context: MutationContext): void {
    if (this.idempotent(context)) return;
    this.assertStatus(["measuring"], "measuring");
    const window = this.state.measurementPlan.windows.find(value => value.id.equals(windowId));
    if (!window) invalid("OUTCOME_WINDOW_INVALID", "Measurement window does not exist.", windowId.value);
    if (window!.status !== "open") invalid("OUTCOME_WINDOW_INVALID", "Only an open measurement window may close.", windowId.value);
    if (context.occurredAt < window!.start) invalid("OUTCOME_WINDOW_INVALID", "Window cannot close before it starts.", windowId.value);
    const windows = this.state.measurementPlan.windows.map(value =>
      value.id.equals(windowId) ? Object.freeze({ ...value, status: "closed" as const }) : value,
    );
    this.commit("measuring", "OutcomeMeasurementWindowClosed", context, { windowId: windowId.value }, {
      measurementPlan: Object.freeze({ ...this.state.measurementPlan, windows: Object.freeze(windows) }),
    });
  }

  public completeMeasurement(context: MutationContext): void {
    if (this.idempotent(context)) return;
    this.assertStatus(["measuring"], "measurement-complete");
    const { completionPolicy } = this.state.measurementPlan;
    const openRequired = completionPolicy.requiredWindowIds.some(id => {
      const window = this.state.measurementPlan.windows.find(value => value.id.equals(id));
      return !window || window.status !== "closed";
    });
    if (openRequired) insufficient("Required measurement windows are not closed.");
    const authoritative = this.state.measurements.filter(value => value.status === "authoritative");
    if (authoritative.length < completionPolicy.minimumRequiredMeasurements) insufficient("Minimum authoritative measurement count is not met.");
    if (completionPolicy.requireEveryPrimaryExpectation) {
      const missing = this.state.expectations.filter(value => value.importance === "primary")
        .some(expectation => !authoritative.some(value => value.expectationId?.equals(expectation.id)));
      if (missing) insufficient("Every primary expectation requires an authoritative measurement.");
    }
    if (authoritative.some(value => this.state.measurements.some(other => other.status === "disputed" && sameMetric(value.metric, other.metric)))) {
      insufficient("An authoritative measurement conflict remains unresolved.");
    }
    if (!evidenceSatisfied(this.state)) insufficient("Required evidence is missing.");
    this.commit("measurement-complete", "OutcomeMeasurementCompleted", context, {
      measurementCount: this.state.measurements.length,
    });
  }

  public markInconclusive(reason: OutcomeInconclusiveReason, dataGaps: readonly OutcomeDataGap[], context: MutationContext): void {
    if (this.idempotent(context)) return;
    this.assertStatus(["measuring", "measurement-complete"], "inconclusive");
    this.commit("inconclusive", "OutcomeMarkedInconclusive", context, { reason }, {
      inconclusive: Object.freeze({ reason, dataGaps: Object.freeze(dataGaps.map(value => Object.freeze({ ...value }))), markedAt: new Date(context.occurredAt) }),
    });
  }

  public close(context: MutationContext): void {
    if (this.idempotent(context)) return;
    this.assertStatus(["measurement-complete"], "closed");
    this.commit("closed", "OutcomeClosed", context, {});
  }

  public cancel(reason: string, context: MutationContext): void {
    if (this.idempotent(context)) return;
    this.assertStatus(["planned", "measuring"], "cancelled");
    required(reason, "cancellation reason");
    this.commit("cancelled", "OutcomeCancelled", context, { reason }, { cancellationReason: reason.trim() });
  }

  public supersede(supersedingOutcomeId: OutcomeId, reason: string, context: MutationContext): void {
    if (this.idempotent(context)) return;
    if (this.status === "superseded") this.assertStatus([], "superseded");
    if (supersedingOutcomeId.equals(this.id)) invalid("OUTCOME_INPUT_INVALID", "An Outcome cannot supersede itself.");
    required(reason, "correction reason");
    this.commit("superseded", "OutcomeSuperseded", context, {
      supersedingOutcomeId: supersedingOutcomeId.value, reason,
    }, {
      lineage: Object.freeze({ ...this.state.lineage, supersedingOutcomeId, correctionReason: reason.trim() }),
    });
  }

  private assertMutable(): void {
    if (TERMINAL.includes(this.status)) throw new OutcomeDomainError("OUTCOME_IMMUTABLE", `Outcome status "${this.status}" is terminal.`);
  }
  private assertStatus(allowed: readonly OutcomeStatus[], to: OutcomeStatus): void {
    if (!allowed.includes(this.status)) throw new OutcomeDomainError("OUTCOME_INVALID_TRANSITION", `Cannot transition Outcome from ${this.status} to ${to}.`, { from: this.status, to });
  }
  private transition(to: OutcomeStatus, allowed: readonly OutcomeStatus[]): void { this.assertStatus(allowed, to); }
  private idempotent(context: MutationContext): boolean {
    date(context.occurredAt, "occurredAt"); required(context.idempotencyKey, "idempotencyKey");
    return this.state.acceptedIdempotencyKeys.includes(context.idempotencyKey);
  }
  private rememberIdempotency(key: string): void {
    this.state = { ...this.state, acceptedIdempotencyKeys: Object.freeze([...this.state.acceptedIdempotencyKeys, key]) };
  }
  private commit(status: OutcomeStatus, type: OutcomeEvent["type"], context: MutationContext, references: OutcomeEvent["references"], patch: Partial<OutcomeState> = {}): void {
    const version = this.version + 1;
    this.state = {
      ...this.state, ...patch, status, version, updatedAt: new Date(context.occurredAt),
      acceptedIdempotencyKeys: Object.freeze([...this.state.acceptedIdempotencyKeys, context.idempotencyKey]),
      events: Object.freeze([...this.state.events, this.event(type, references, context, version)]),
    };
  }
  private event(type: OutcomeEvent["type"], references: OutcomeEvent["references"], context: MutationContext, version: number): OutcomeEvent {
    return Object.freeze({
      eventId: context.eventId ?? `${this.id.value}:${version}:${context.idempotencyKey}`,
      aggregateId: this.id, aggregateVersion: version, ownerId: this.ownerId,
      occurredAt: new Date(context.occurredAt), type, references: Object.freeze({ ...references }),
      idempotencyKey: context.idempotencyKey,
    });
  }
}

function validateOrigin(origin: OutcomeOrigin): void {
  if (origin.type === "manual-measurement" && !origin.reasonCode) invalid("OUTCOME_INPUT_INVALID", "Manual origin requires a reason.");
  const entries = Object.entries(origin).filter(([key]) => key.endsWith("Id"));
  for (const [, value] of entries) required(String(value), "origin reference");
}
function validateSubject(subject: OutcomeSubject): void {
  for (const [key, value] of Object.entries(subject)) if (key.endsWith("Id") && value !== undefined) required(String(value), "subject reference");
}
function validateLineage(lineage: OutcomeLineage): void {
  if (lineage.decisionReferences.length > OUTCOME_LIMITS.decisionReferences) limit("decision references");
  if (lineage.executionReferences.length > OUTCOME_LIMITS.executionReferences) limit("execution references");
  unique(lineage.decisionReferences.map(value => value.decisionId), "decision reference");
  unique(lineage.recommendationReferences.map(value => value.recommendationId), "recommendation reference");
  unique(lineage.executionReferences.map(value => value.type === "action" ? value.actionId : value.type === "acquisition-stage" ? `${value.pipelineId}:${value.stage}` : value.executionId), "execution reference");
}
function validatePlan(expectations: readonly OutcomeExpectation[], plan: OutcomeMeasurementPlan, mode: OutcomePlanningMode, plannedAt: Date): void {
  if (!expectations.length || expectations.length > OUTCOME_LIMITS.expectations) invalid("OUTCOME_EXPECTATION_INVALID", "Outcome requires 1-12 expectations.");
  if (!expectations.some(value => value.importance === "primary")) invalid("OUTCOME_EXPECTATION_INVALID", "Outcome requires a primary expectation.");
  if (!plan.windows.length || plan.windows.length > OUTCOME_LIMITS.windows) invalid("OUTCOME_WINDOW_INVALID", "Measurement plan requires 1-8 windows.");
  unique(expectations.map(value => value.id.value), "expectation");
  unique(plan.windows.map(value => value.id.value), "measurement window");
  const windowIds = new Set(plan.windows.map(value => value.id.value));
  for (const window of plan.windows) {
    date(window.start, "window start"); date(window.end, "window end");
    if (window.start >= window.end) invalid("OUTCOME_WINDOW_INVALID", "Window start must precede end.", window.id.value);
    if (window.comparisonWindowId && !windowIds.has(window.comparisonWindowId.value)) invalid("OUTCOME_WINDOW_INVALID", "Comparison window does not exist.", window.id.value);
    if (window.comparisonWindowId?.equals(window.id)) invalid("OUTCOME_WINDOW_INVALID", "Window cannot compare to itself.", window.id.value);
  }
  if (!plan.windows.some(value => value.type === "primary")) invalid("OUTCOME_WINDOW_INVALID", "A primary measurement window is required.");
  for (const expectation of expectations) {
    if (!windowIds.has(expectation.measurementWindowId.value)) invalid("OUTCOME_EXPECTATION_INVALID", "Expectation window does not exist.", expectation.id.value);
    validateTarget(expectation.metric.kind, expectation.target);
    if (expectation.baseline) {
      validateValue(expectation.metric.kind, expectation.baseline.value, "baseline");
      if (expectation.baseline.observationWindow.start >= expectation.baseline.observationWindow.end) invalid("OUTCOME_EXPECTATION_INVALID", "Baseline window is invalid.", expectation.id.value);
    }
    if (expectation.tolerance?.type === "absolute") validateValue(expectation.metric.kind, expectation.tolerance.value, "tolerance");
    if (mode === "prospective" && (expectation.reconstructed || expectation.establishedAt > plannedAt)) invalid("OUTCOME_EXPECTATION_INVALID", "Prospective expectations must be contemporaneous.", expectation.id.value);
    if (mode === "retrospective" && expectation.reconstructed && expectation.source.type === "manual" && !expectation.source.retrospective) invalid("OUTCOME_EXPECTATION_INVALID", "Reconstructed expectation must be labeled retrospective.", expectation.id.value);
  }
  for (const id of plan.requiredExpectations) if (!expectations.some(value => value.id.equals(id))) invalid("OUTCOME_EXPECTATION_INVALID", "Plan references an unknown expectation.", id.value);
  for (const id of plan.completionPolicy.requiredWindowIds) if (!windowIds.has(id.value)) invalid("OUTCOME_WINDOW_INVALID", "Completion policy references an unknown window.", id.value);
  if (!Number.isInteger(plan.completionPolicy.minimumRequiredMeasurements) || plan.completionPolicy.minimumRequiredMeasurements < 0) invalid("OUTCOME_INPUT_INVALID", "Minimum measurements must be a non-negative integer.");
}
function validateTarget(kind: string, target: OutcomeTarget): void {
  if ("value" in target) validateValue(target.type === "relative-change" ? "percentage" : kind, target.value as OutcomeValue, "target");
  if (target.type === "range") {
    validateValue(kind, target.minimum, "range minimum"); validateValue(kind, target.maximum, "range maximum");
    if (numeric(target.minimum) > numeric(target.maximum)) invalid("OUTCOME_EXPECTATION_INVALID", "Range minimum cannot exceed maximum.");
    if (target.minimum.kind === "money" && target.maximum.kind === "money" && target.minimum.value.currency !== target.maximum.value.currency) invalid("OUTCOME_EXPECTATION_INVALID", "Range currencies must match.");
  }
}
function validateValue(kind: string, value: OutcomeValue, label: string): void {
  if (kind !== value.kind) invalid("OUTCOME_EXPECTATION_INVALID", `${label} kind "${value.kind}" is incompatible with metric kind "${kind}".`);
  if ((value.kind === "ratio" || value.kind === "count" || value.kind === "duration") && !Number.isFinite(value.value)) invalid("OUTCOME_EXPECTATION_INVALID", `${label} must be finite.`);
  if (value.kind === "count" && (!Number.isInteger(value.value) || value.value < 0)) invalid("OUTCOME_EXPECTATION_INVALID", `${label} count must be a non-negative integer.`);
  if (value.kind === "duration" && value.value < 0) invalid("OUTCOME_EXPECTATION_INVALID", `${label} duration must be non-negative.`);
}
function validateCurrencyCompatibility(expectation: OutcomeExpectation, actual: OutcomeValue): void {
  const baseline = expectation.baseline?.value;
  const target = "value" in expectation.target && expectation.target.type !== "relative-change" ? expectation.target.value : undefined;
  const currencies = [baseline, target, actual].filter((value): value is Extract<OutcomeValue, { kind: "money" }> => value?.kind === "money").map(value => value.value.currency);
  if (new Set(currencies).size > 1) invalid("OUTCOME_MEASUREMENT_INVALID", "Measurement currency is incompatible with baseline or target.", expectation.id.value);
}
function evidenceSatisfied(state: OutcomeState): boolean {
  return state.measurementPlan.evidenceRequirements.filter(value => value.required).every(requirement =>
    requirement.requiredRoles.every(role => state.evidence.some(evidence =>
      evidence.role === role
      && (!requirement.metricKey || state.measurements.some(measurement => measurement.metric.key.equals(requirement.metricKey!) && measurement.status === "authoritative"))
      && (!requirement.expectationId || state.measurements.some(measurement => measurement.expectationId?.equals(requirement.expectationId!) && measurement.status === "authoritative"))
      && (!requirement.minimumConfidence || evidence.confidence.score.value >= requirement.minimumConfidence.value),
    )),
  );
}
function sameMetric(a: { key: OutcomeId; kind: string }, b: { key: OutcomeId; kind: string }): boolean { return a.key.equals(b.key) && a.kind === b.kind; }
function numeric(value: OutcomeValue): number {
  if (value.kind === "money") return value.value.amount;
  if (value.kind === "percentage" || value.kind === "score") return value.value.value;
  if (value.kind === "boolean") return value.value ? 1 : 0;
  if (value.kind === "qualitative") return 0;
  return value.value;
}
function required(value: string, field: string): string {
  if (!value.trim()) invalid("OUTCOME_INPUT_INVALID", `${field} is required.`);
  return value.trim();
}
function date(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) invalid("OUTCOME_INPUT_INVALID", `${field} must be a valid Date.`);
}
function unique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) duplicate(label);
}
function invalid(code: ConstructorParameters<typeof OutcomeDomainError>[0], message: string, referenceId?: string): never {
  throw new OutcomeDomainError(code, message, referenceId ? { referenceId } : undefined);
}
function duplicate(label: string, referenceId?: string): never { return invalid("OUTCOME_DUPLICATE", `Duplicate ${label} is not allowed.`, referenceId); }
function limit(label: string): never { return invalid("OUTCOME_COLLECTION_LIMIT", `Outcome ${label} collection limit exceeded.`); }
function insufficient(message: string): never { return invalid("OUTCOME_EVIDENCE_INSUFFICIENT", message); }
function freezeSubject(subject: OutcomeSubject): OutcomeSubject { return Object.freeze({ ...subject }); }
function cloneEvidence(value: OutcomeEvidenceReference): OutcomeEvidenceReference { return Object.freeze({ ...value, ...(value.capturedAt ? { capturedAt: new Date(value.capturedAt) } : {}) }); }
function cloneExpectation(value: OutcomeExpectation): OutcomeExpectation { return Object.freeze({ ...value, establishedAt: new Date(value.establishedAt), baseline: value.baseline ? Object.freeze({ ...value.baseline, observationWindow: cloneWindow(value.baseline.observationWindow) }) : null }); }
function cloneWindow<T extends { start: Date; end: Date }>(value: T): T { return Object.freeze({ ...value, start: new Date(value.start), end: new Date(value.end) }); }
function clonePlan(value: OutcomeMeasurementPlan): OutcomeMeasurementPlan { return Object.freeze({ ...value, approvedAt: new Date(value.approvedAt), windows: Object.freeze(value.windows.map(cloneWindow)), requiredExpectations: Object.freeze([...value.requiredExpectations]), evidenceRequirements: Object.freeze(value.evidenceRequirements.map(item => Object.freeze({ ...item, requiredRoles: Object.freeze([...item.requiredRoles]) }))), completionPolicy: Object.freeze({ ...value.completionPolicy, requiredWindowIds: Object.freeze([...value.completionPolicy.requiredWindowIds]) }), attributionPlan: Object.freeze({ ...value.attributionPlan, approvedBases: Object.freeze([...value.attributionPlan.approvedBases]) }) }); }
function cloneLineage(value: OutcomeLineage): OutcomeLineage { return Object.freeze({ ...value, decisionReferences: Object.freeze(value.decisionReferences.map(item => Object.freeze({ ...item }))), recommendationReferences: Object.freeze(value.recommendationReferences.map(item => Object.freeze({ ...item }))), executionReferences: Object.freeze(value.executionReferences.map(item => Object.freeze({ ...item, ...("completedAt" in item && item.completedAt ? { completedAt: new Date(item.completedAt) } : {}) }))), observationReferences: Object.freeze(value.observationReferences.map(item => Object.freeze({ ...item }))), analysisReferences: Object.freeze(value.analysisReferences.map(item => Object.freeze({ ...item }))) }); }
function cloneAttribution(value: OutcomeAttribution): OutcomeAttribution { return Object.freeze({ ...value, basis: Object.freeze(value.basis.map(item => Object.freeze({ ...item, evidence: Object.freeze(item.evidence.map(cloneEvidence)) }))), competingFactors: Object.freeze(value.competingFactors.map(item => Object.freeze({ ...item, evidence: Object.freeze(item.evidence.map(cloneEvidence)) }))), ...(value.assessedAt ? { assessedAt: new Date(value.assessedAt) } : {}) }); }
function cloneQualitative(value: OutcomeQualitativeObservation): OutcomeQualitativeObservation { return Object.freeze({ ...value, observedAt: new Date(value.observedAt), recordedAt: new Date(value.recordedAt), evidence: Object.freeze(value.evidence.map(cloneEvidence)) }); }
function cloneState(value: OutcomeState): OutcomeState { return Object.freeze({ ...value, subject: freezeSubject(value.subject), origin: Object.freeze({ ...value.origin }), expectations: Object.freeze(value.expectations.map(cloneExpectation)), measurementPlan: clonePlan(value.measurementPlan), measurements: Object.freeze(value.measurements.map(item => Object.freeze({ ...item, observedAt: new Date(item.observedAt), recordedAt: new Date(item.recordedAt) }))), qualitativeObservations: Object.freeze(value.qualitativeObservations.map(cloneQualitative)), evidence: Object.freeze(value.evidence.map(cloneEvidence)), attribution: cloneAttribution(value.attribution), lineage: cloneLineage(value.lineage), createdAt: new Date(value.createdAt), updatedAt: new Date(value.updatedAt), events: Object.freeze(value.events.map(item => Object.freeze({ ...item, occurredAt: new Date(item.occurredAt), references: Object.freeze({ ...item.references }) }))), acceptedIdempotencyKeys: Object.freeze([...value.acceptedIdempotencyKeys]), ...(value.inconclusive ? { inconclusive: Object.freeze({ ...value.inconclusive, markedAt: new Date(value.inconclusive.markedAt), dataGaps: Object.freeze(value.inconclusive.dataGaps.map(item => Object.freeze({ ...item }))) }) } : {}) }); }

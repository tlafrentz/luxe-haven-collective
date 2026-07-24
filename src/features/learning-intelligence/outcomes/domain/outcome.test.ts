import { Money, Percentage } from "@/platform/kernel";
import { describe, expect, it } from "vitest";
import { Outcome } from "./outcome";
import { OutcomeDomainError } from "./outcome-errors";
import { createOutcomeId, createOutcomeMeasurementId } from "./outcome-id";
import { expectation, measurement, planInput, plannedOutcome, t, windowId } from "./outcome.test-support";

const context = (day: number, idempotencyKey: string) => ({ occurredAt: t(day), idempotencyKey });

describe("LI-001 Outcome aggregate", () => {
  it("plans a canonical outcome without evaluating success", () => {
    const outcome = plannedOutcome();
    expect(outcome.status).toBe("planned");
    expect(outcome.version).toBe(1);
    expect(outcome.props.events[0]).toMatchObject({ type: "OutcomePlanned", aggregateVersion: 1 });
    expect(outcome.props).not.toHaveProperty("successful");
    expect(outcome.props.expectations[0]!.target).toEqual(expectation.target);
    expect(outcome.props.measurements).toEqual([]);
  });

  it("preserves decision, execution, expectation, and subject lineage independently", () => {
    const state = plannedOutcome().props;
    expect(state.origin).toMatchObject({ type: "decision", decisionId: "decision-1", decisionVersion: 2 });
    expect(state.lineage.executionReferences[0]).toMatchObject({ type: "action", actionId: "action-1", completion: "complete" });
    expect(state.subject).toEqual({ type: "property", propertyId: "property-1" });
    expect(state.expectations[0]!.source).toEqual({ type: "decision", decisionId: "decision-1" });
  });

  it("requires explicit manual origin reason and a primary expectation", () => {
    expect(() => Outcome.plan(planInput({ origin: { type: "manual-measurement", reasonCode: "" } }))).toThrow(OutcomeDomainError);
    expect(() => Outcome.plan(planInput({ expectations: [{ ...expectation, importance: "secondary" }] }))).toThrow(/primary expectation/);
  });

  it("validates windows, comparison references, and expectation window membership", () => {
    const badPlan = { ...planInput().measurementPlan, windows: [{ id: windowId, type: "primary", start: t(10), end: t(2), status: "planned" }] };
    expect(() => Outcome.plan(planInput({ measurementPlan: badPlan }))).toThrow(/start must precede/);
    const self = { ...planInput().measurementPlan, windows: [{ id: windowId, type: "primary", start: t(2), end: t(10), status: "planned", comparisonWindowId: windowId }] };
    expect(() => Outcome.plan(planInput({ measurementPlan: self }))).toThrow(/compare to itself/);
  });

  it("starts measuring only after execution and freezes planning facts", () => {
    const outcome = plannedOutcome();
    outcome.startMeasurement(context(2, "start"));
    expect(outcome.status).toBe("measuring");
    expect(outcome.props.measurementPlan.windows[0]!.status).toBe("open");
    expect(Object.isFrozen(outcome.props.expectations)).toBe(true);
    const unexecuted = Outcome.plan(planInput({ lineage: { ...planInput().lineage, executionReferences: [{ type: "action", actionId: "action-1", completion: "not-started" }] } }));
    expect(() => unexecuted.startMeasurement(context(2, "start"))).toThrow(/before execution/);
  });

  it("records immutable typed measurements and rejects incompatible values", () => {
    const outcome = plannedOutcome();
    outcome.startMeasurement(context(2, "start"));
    outcome.recordMeasurement(measurement(), context(6, "record"));
    expect(outcome.props.measurements[0]).toMatchObject({ status: "authoritative", late: false });
    expect(Object.isFrozen(outcome.props.measurements)).toBe(true);
    expect(() => outcome.recordMeasurement(measurement({
      id: createOutcomeMeasurementId("measurement-2"),
      value: { kind: "percentage", value: Percentage.create(5) },
    }), context(7, "bad-kind"))).toThrow(/incompatible/);
  });

  it("rejects duplicate measurements, closed-window mutation, and late evidence under reject policy", () => {
    const outcome = plannedOutcome();
    outcome.startMeasurement(context(2, "start"));
    outcome.recordMeasurement(measurement(), context(6, "record"));
    expect(() => outcome.recordMeasurement(measurement(), context(7, "duplicate"))).toThrow(/Duplicate measurement/);
    outcome.closeWindow(windowId, context(10, "close-window"));
    expect(() => outcome.recordMeasurement(measurement({ id: createOutcomeMeasurementId("late"), observedAt: t(11) }), context(11, "late"))).toThrow(/Late measurement/);
  });

  it("completes measurement without assigning success, then closes", () => {
    const outcome = plannedOutcome();
    outcome.startMeasurement(context(2, "start"));
    outcome.recordMeasurement(measurement(), context(6, "record"));
    outcome.closeWindow(windowId, context(10, "close-window"));
    outcome.completeMeasurement(context(11, "complete"));
    expect(outcome.status).toBe("measurement-complete");
    expect(outcome.props.events.at(-1)?.type).toBe("OutcomeMeasurementCompleted");
    expect(outcome.props).not.toHaveProperty("variance");
    outcome.close(context(12, "close"));
    expect(outcome.status).toBe("closed");
    expect(() => outcome.recordMeasurement(measurement({ id: createOutcomeMeasurementId("after-close") }), context(12, "mutate"))).toThrow();
  });

  it("keeps insufficient evidence distinct from unsuccessful", () => {
    const outcome = plannedOutcome();
    outcome.startMeasurement(context(2, "start"));
    expect(() => outcome.completeMeasurement(context(3, "premature"))).toThrow(/windows are not closed/);
    outcome.markInconclusive("INSUFFICIENT_MEASUREMENTS", [{ code: "NO_DATA", description: "Source unavailable" }], context(4, "inconclusive"));
    expect(outcome.status).toBe("inconclusive");
    expect(outcome.props.inconclusive?.reason).toBe("INSUFFICIENT_MEASUREMENTS");
  });

  it("supports cancellation and explicit immutable supersession", () => {
    const cancelled = plannedOutcome();
    cancelled.cancel("EXECUTION_NOT_STARTED", context(2, "cancel"));
    expect(cancelled.status).toBe("cancelled");
    const corrected = plannedOutcome();
    corrected.supersede(createOutcomeId("outcome-2"), "Corrected origin", context(2, "supersede"));
    expect(corrected.props.lineage).toMatchObject({ supersedingOutcomeId: { value: "outcome-2" }, correctionReason: "Corrected origin" });
    expect(() => corrected.attachEvidence({} as never, context(3, "change"))).toThrow(/terminal/);
  });

  it("does not duplicate state or events for repeated idempotency keys", () => {
    const outcome = plannedOutcome();
    outcome.startMeasurement(context(2, "start"));
    const version = outcome.version;
    outcome.startMeasurement(context(2, "start"));
    expect(outcome.version).toBe(version);
    expect(outcome.props.events.filter(event => event.type === "OutcomeMeasurementStarted")).toHaveLength(1);
  });

  it("protects rehydrated state from external mutation", () => {
    const outcome = plannedOutcome();
    const exposed = outcome.props;
    exposed.createdAt.setUTCFullYear(2000);
    expect(outcome.props.createdAt.getUTCFullYear()).toBe(2026);
  });

  it("preserves harmful or negative money observations as facts", () => {
    const outcome = plannedOutcome();
    outcome.startMeasurement(context(2, "start"));
    outcome.recordMeasurement(measurement({ value: { kind: "money", value: Money.usd(-25) } }), context(6, "negative"));
    expect((outcome.props.measurements[0]!.value as { value: Money }).value.amount).toBe(-25);
  });
});

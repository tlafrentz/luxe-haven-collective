import { describe, expect, it } from "vitest";
import {
  buildInitialMeasurementAdapters,
  getOutcomeReviewReadiness,
  recordManualMeasuredOutcome,
  scheduleOutcomeReviews,
} from "./outcome-review-services";
import type {
  ExpectedOutcomeSpecification,
  VersionedMeasurementPlan,
} from "../domain";

const expected: ExpectedOutcomeSpecification = Object.freeze({
  id: "expected:adr",
  metric: Object.freeze({
    key: "adr",
    name: "Average daily rate",
    valueType: "money",
    currency: "USD",
    directionality: "higher-is-better",
    aggregation: "average",
    definitionVersion: "adr-v1",
  }),
  expectation: Object.freeze({
    type: "target",
    target: Object.freeze({ value: 210, type: "money", currency: "USD" }),
  }),
  materialityPolicy: Object.freeze({
    key: "adr-materiality",
    metricKey: "adr",
    thresholds: [{ level: "material" as const, relative: 0.05 }],
    version: "v1",
  }),
  required: true,
  measurementSource: Object.freeze({ adapterKey: "investment", metricKey: "adr", scope: Object.freeze({ type: "property", id: "property:1" }), policyVersion: "investment-v1" }),
  confidence: "high",
  evidence: Object.freeze([{ type: "scenario" as const, capability: "investment-intelligence", sourceId: "scenario:1" }]),
});

const plan: VersionedMeasurementPlan = Object.freeze({
  id: "plan:1:v1",
  seriesId: "plan:1",
  workspaceId: "workspace:1",
  learningSubjectId: "subject:1",
  revision: 1,
  status: "active",
  title: "First operating year",
  baselineSnapshot: Object.freeze({
    capturedAt: "2026-01-01T00:00:00.000Z",
    scope: Object.freeze({ type: "property", id: "property:1", timezone: "America/Chicago" }),
    values: Object.freeze([]),
    qualification: "actual",
    sourceVersions: Object.freeze([]),
    evidence: Object.freeze([{ type: "scenario" as const, capability: "investment-intelligence", sourceId: "scenario:1" }]),
    confidence: "high",
    freshness: "current",
    schemaVersion: "v1",
  }),
  expectedOutcomes: Object.freeze([expected]),
  executionRequirement: "action-completed",
  reviewWindows: Object.freeze([{
    id: "window:1",
    sequence: 1,
    label: "90 days",
    trigger: Object.freeze({ type: "after-action-completion", delayDays: 90 }),
    measurementPeriod: Object.freeze({ type: "relative", durationDays: 90 }),
    required: true,
    timezone: "America/Chicago",
  }]),
  confidence: "high",
  evidence: Object.freeze([{ type: "scenario" as const, capability: "investment-intelligence", sourceId: "scenario:1" }]),
  policyVersion: "measurement-v1",
  createdByProfileId: "profile:1",
  createdAt: "2026-01-01T00:00:00.000Z",
  activatedAt: "2026-01-02T00:00:00.000Z",
});

describe("outcome-review application services", () => {
  it("schedules every active plan window idempotently", () => {
    const first = scheduleOutcomeReviews(plan, "2026-01-02T00:00:00.000Z");
    const second = scheduleOutcomeReviews(plan, "2026-01-02T00:00:00.000Z");
    expect(first.schedules).toEqual(second.schedules);
    expect(first.schedules[0]?.triggerStatus).toBe("waiting");
  });

  it("keeps unavailable provider state separate from outcome failure", async () => {
    const unavailable = {
      canMeasure: async () => ({
        available: false,
        reason: "provider-unavailable",
        sourceVersions: [],
        freshness: "unknown" as const,
      }),
      retrieveMeasurement: async () => {
        throw new Error("must not retrieve");
      },
    };
    const registry = buildInitialMeasurementAdapters({
      investment: unavailable,
      revenue: unavailable,
      capital: unavailable,
    });
    const result = await registry.resolve(expected.measurementSource).canMeasure({
      workspaceId: "workspace:1",
      subjectId: "subject:1",
      expected,
      period: { start: "2026-01-01", end: "2026-04-01" },
    });
    expect(result).toMatchObject({ available: false, reason: "provider-unavailable" });
  });

  it("requires permission, attribution, and evidence for manual values", () => {
    expect(() => recordManualMeasuredOutcome({
      id: "measurement:1",
      workspaceId: "workspace:1",
      reviewId: "review:1",
      expected,
      value: Object.freeze({ value: 205, type: "money", currency: "USD" }),
      period: { start: "2026-01-01", end: "2026-04-01" },
      observedAt: "2026-04-02T00:00:00.000Z",
      enteredByProfileId: "profile:1",
      sourceNote: "Owner statement",
      evidence: Object.freeze([{ type: "evidence", capability: "manual-measurement", sourceId: "statement:1" }]),
      confidence: "moderate",
      freshness: "current",
      createdAt: "2026-04-02T00:00:00.000Z",
      policyVersion: "measurement-v1",
      authorized: false,
    })).toThrowError(/permission/i);
  });

  it("returns structured readiness rather than an opaque boolean", () => {
    const readiness = getOutcomeReviewReadiness({
      plan,
      window: plan.reviewWindows[0]!,
      execution: Object.freeze({
        requirement: "action-completed",
        sourceReferences: Object.freeze([]),
        status: "waiting",
        evidence: Object.freeze([]),
      }),
      evaluatedAt: "2026-02-01T00:00:00.000Z",
      measurements: Object.freeze([]),
      policyVersion: "readiness-v1",
    });
    expect(readiness.status).toBe("waiting-for-execution");
    expect(readiness.reasons.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { evaluateExecuteOutcome, transitionExecuteMeasurement, validateExecuteMeasurementWindow } from "./execute-outcome-measurement";

const value = (amount: number) => ({ type: "decimal" as const, value: amount, unit: "points" });
const rule = { type: "absolute-change" as const, direction: "at-least" as const, target: value(110), minimumMeaningfulChange: 3, partialAchievementThreshold: .5 };

describe("EX-002 outcome measurement policy", () => {
  it("enforces the canonical lifecycle and reasoned reopening", () => {
    expect(transitionExecuteMeasurement("draft", "scheduled")).toBe("scheduled");
    expect(() => transitionExecuteMeasurement("draft", "finalized")).toThrow(/Invalid measurement transition/);
    expect(() => transitionExecuteMeasurement("finalized", "in-progress")).toThrow(/requires a reason/);
    expect(transitionExecuteMeasurement("finalized", "in-progress", "Corrected provider snapshot")).toBe("in-progress");
  });

  it("validates windows without discarding their time-zone context", () => {
    const window = validateExecuteMeasurementWindow({ start: "2026-08-10T00:00:00Z", end: "2026-09-10T00:00:00Z", timezone: "America/Chicago", gracePeriodDays: 2 });
    expect(window.timezone).toBe("America/Chicago");
    expect(() => validateExecuteMeasurementWindow({ ...window, end: window.start })).toThrow(/window is invalid/i);
  });

  it("classifies target attainment and explicit partial achievement deterministically", () => {
    expect(evaluateExecuteOutcome({ baseline: value(100), actual: value(111), rule, guardrails: [], dataQuality: "complete", confidence: "high", policyVersion: "ex002.v1" }).classification).toBe("achieved");
    expect(evaluateExecuteOutcome({ baseline: value(100), actual: value(106), rule, guardrails: [], dataQuality: "sufficient", confidence: "moderate", policyVersion: "ex002.v1" }).classification).toBe("partially-achieved");
    expect(evaluateExecuteOutcome({ baseline: value(100), actual: value(101), rule, guardrails: [], dataQuality: "complete", confidence: "high", policyVersion: "ex002.v1" }).classification).toBe("not-achieved");
  });

  it("does not silently claim success with failed or incomplete guardrails", () => {
    expect(() => evaluateExecuteOutcome({ baseline: value(100), actual: value(111), rule, guardrails: [{ id: "occupancy", required: true, evaluated: false }], dataQuality: "complete", confidence: "high", policyVersion: "ex002.v1" })).toThrow(/guardrail/i);
    expect(evaluateExecuteOutcome({ baseline: value(100), actual: value(111), rule, guardrails: [{ id: "occupancy", required: true, evaluated: true, passed: false }], dataQuality: "complete", confidence: "high", policyVersion: "ex002.v1" }).classification).toBe("not-achieved");
  });

  it("keeps poor data distinct from a failed outcome", () => {
    expect(evaluateExecuteOutcome({ baseline: value(100), actual: value(111), rule, guardrails: [], dataQuality: "conflicting", confidence: "low", policyVersion: "ex002.v1" }).classification).toBe("inconclusive");
    expect(evaluateExecuteOutcome({ baseline: value(100), actual: value(111), rule, guardrails: [], dataQuality: "missing", confidence: "insufficient-evidence", policyVersion: "ex002.v1" }).classification).toBe("not-measurable");
  });

  it("rejects incompatible units and zero-denominator percentage comparisons", () => {
    expect(() => evaluateExecuteOutcome({ baseline: value(100), actual: { ...value(110), unit: "seconds" }, rule, guardrails: [], dataQuality: "complete", confidence: "high", policyVersion: "ex002.v1" })).toThrow(/units must match/i);
    expect(() => evaluateExecuteOutcome({ baseline: value(0), actual: value(4), rule: { ...rule, type: "percentage-change", target: value(10) }, guardrails: [], dataQuality: "complete", confidence: "high", policyVersion: "ex002.v1" })).toThrow(/zero baseline/i);
  });
});

import { describe, expect, it } from "vitest";
import { Identifier } from "../../kernel";
import { createOutcomeId } from "./outcome-id";
import { Outcome } from "./outcome";
import { lineage } from "../outcome-fixtures.test-support";

describe("Outcome", () => {
  it("creates an immutable measured fact with duration, metrics, payload, and traceability", () => {
    const value = Outcome.create({ id: createOutcomeId("outcome-1"), title: " Result ", summary: " Work completed ", type: "action-outcome", status: "completed", successful: true,
      startedAt: new Date("2026-07-19T10:00:00Z"), completedAt: new Date("2026-07-19T10:00:02Z"), metrics: { revenueImpact: 250 }, result: { recordsProcessed: 4 }, notes: ["  Verified  ", "Verified"], lineage: lineage(),
    });
    expect(value.title).toBe("Result"); expect(value.durationMs).toBe(2000); expect(value.metrics).toEqual({ revenueImpact: 250 });
    expect(value.result).toEqual({ recordsProcessed: 4 }); expect(value.notes).toEqual(["Verified"]);
    expect(value.traces(Identifier.create("observation-1"))).toBe(true); expect(Object.isFrozen(value)).toBe(true);
  });
  it("validates terminal status, success, chronology, and finite metrics", () => {
    const base = { id: createOutcomeId("invalid"), title: "Invalid", summary: "Invalid result", type: "manual-outcome", lineage: lineage(), startedAt: new Date("2026-07-19T10:00:00Z") };
    expect(() => Outcome.create({ ...base, status: "completed", successful: true })).toThrow("requires a completion date");
    expect(() => Outcome.create({ ...base, status: "failed", successful: true, completedAt: new Date() })).toThrow("cannot be successful");
    expect(() => Outcome.create({ ...base, status: "completed", successful: true, completedAt: new Date("2026-07-19T09:00:00Z") })).toThrow("cannot precede");
    expect(() => Outcome.create({ ...base, status: "running", successful: false, metrics: { invalid: Number.NaN } })).toThrow("must be finite");
  });
});

import { describe, expect, it } from "vitest";
import { OutcomeBuilder } from "../application";
import { completedAction, lineage } from "../outcome-fixtures.test-support";
import { OutcomeCollection } from "./outcome-collection";

function outcome() {
  return new OutcomeBuilder().build({ source: { type: "action", action: completedAction() }, result: {
    title: "Action result", summary: "Completed.", status: "completed", successful: true, metrics: { impact: 10 }, lineage: lineage(),
  } });
}
describe("OutcomeCollection", () => {
  it("supports lookup, filtering, grouping, lineage queries, and metric aggregation", () => {
    const value = outcome(), collection = OutcomeCollection.create([value]);
    expect(collection.require(value.id)).toBe(value); expect(collection.ofStatus("completed").size).toBe(1);
    expect(collection.ofType("action-outcome").size).toBe(1); expect(collection.successful().size).toBe(1);
    expect(collection.tracing(completedAction().id).size).toBe(1); expect(collection.groupByStatus().get("completed")?.size).toBe(1);
    expect(collection.sumMetric("impact")).toBe(10); expect(collection.averageMetric("impact")).toBe(10);
  });
  it("rejects duplicate identities", () => { const value = outcome(); expect(() => OutcomeCollection.create([value, value])).toThrow("Outcome IDs must be unique."); });
});

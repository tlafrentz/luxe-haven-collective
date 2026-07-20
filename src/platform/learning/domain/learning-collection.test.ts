import { describe, expect, it } from "vitest";
import { LearningBuilder } from "../application";
import { policy, records } from "../learning-fixtures.test-support";
import { LearningCollection } from "./learning-collection";

describe("LearningCollection", () => {
  it("supports lookup, filtering, grouping, aggregation, and trace queries", async () => {
    const report = new LearningBuilder().build({ result: (await policy.learn({ records: records() }))! }), collection = LearningCollection.create([report]);
    expect(collection.require(report.id)).toBe(report); expect(collection.withConfidence(report.confidence.level).size).toBe(1);
    expect(collection.containing("policy-improvement").size).toBe(1); expect(collection.tracing(records().outcomes.toArray()[0].id).size).toBe(1);
    expect(collection.groupByConfidence().get(report.confidence.level)?.size).toBe(1);
    expect(collection.countArtifacts()).toEqual({ "learning-insight": 1, "policy-improvement": 1, "scoring-improvement": 1, "confidence-calibration": 1 });
  });
  it("rejects duplicate reports", async () => { const report = new LearningBuilder().build({ result: (await policy.learn({ records: records() }))! }); expect(() => LearningCollection.create([report, report])).toThrow("Learning report IDs must be unique."); });
});

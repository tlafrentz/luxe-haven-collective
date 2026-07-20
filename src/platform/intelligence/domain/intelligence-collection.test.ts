import { describe, expect, it } from "vitest";
import { IntelligenceBuilder } from "../application";
import { outcomes, policy } from "../intelligence-fixtures.test-support";
import { IntelligenceCollection } from "./intelligence-collection";

describe("IntelligenceCollection", () => {
  it("supports lookup, filtering, grouping, aggregation, and trace queries", async () => {
    const result = await policy.analyze({ records: { outcomes: outcomes() } }), report = new IntelligenceBuilder().build({ result: result! });
    const collection = IntelligenceCollection.create([report]);
    expect(collection.require(report.id)).toBe(report); expect(collection.withConfidence(report.confidence.level).size).toBe(1);
    expect(collection.containing("forecast").size).toBe(1); expect(collection.tracing(outcomes().toArray()[0].id).size).toBe(1);
    expect(collection.groupByConfidence().get(report.confidence.level)?.size).toBe(1);
    expect(collection.countArtifacts()).toEqual({ insight: 1, trend: 1, opportunity: 1, forecast: 1, anomaly: 1 });
  });
  it("rejects duplicate report identities", async () => {
    const result = await policy.analyze({ records: { outcomes: outcomes() } }), report = new IntelligenceBuilder().build({ result: result! });
    expect(() => IntelligenceCollection.create([report, report])).toThrow("Intelligence report IDs must be unique.");
  });
});

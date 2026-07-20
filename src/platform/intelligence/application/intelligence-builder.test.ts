import { describe, expect, it } from "vitest";
import { confidence, outcome, outcomes, policy } from "../intelligence-fixtures.test-support";
import { IntelligenceBuilder } from "./intelligence-builder";

describe("IntelligenceBuilder", () => {
  it("builds insights, trends, opportunities, forecasts, and anomalies", async () => {
    const result = await policy.analyze({ records: { outcomes: outcomes() } });
    const report = new IntelligenceBuilder().build({ result: result! });
    expect(report.artifactCount).toBe(5); expect(report.insights[0].businessImpact).toEqual({ revenue: 1200 });
    expect(report.trends[0].change).toBe(200); expect(report.opportunities[0].expectedImpact).toEqual({ revenue: 300 });
    expect(report.forecasts[0].prediction).toBe(1400); expect(report.anomalies[0].explanation).toContain("20%");
  });
  it("derives complete explainability from supporting Outcomes", async () => {
    const result = await policy.analyze({ records: { outcomes: outcomes() } });
    const insight = new IntelligenceBuilder().build({ result: result! }).insights[0];
    expect(insight.explainability.supportingOutcomeIds[0].value).toBe("outcome-1");
    expect(insight.explainability.lineage.actionIds[0].value).toBe("action-1");
    expect(insight.explainability.lineage.decisionIds[0].value).toBe("decision-1");
    expect(insight.explainability.rationale).toEqual(["Measured Outcomes show a reproducible change."]);
  });
  it("propagates the least artifact confidence to the report", async () => {
    const result = await policy.analyze({ records: { outcomes: outcomes() } });
    expect(new IntelligenceBuilder().build({ result: result! }).confidence.score.value).toBe(70);
  });
  it("validates supporting records, trends, forecasts, and empty report confidence", () => {
    const base = { title: "Invalid", summary: "Invalid intelligence", reportingPeriod: { start: new Date(), end: new Date() } };
    expect(() => new IntelligenceBuilder().build({ result: { ...base, insights: [{ title: "No support", summary: "Missing Outcomes", supportingOutcomes: [], confidence: confidence(), rationale: ["None"] }] } })).toThrow("supporting Outcomes cannot be empty");
    expect(() => new IntelligenceBuilder().build({ result: { ...base, trends: [{ title: "Short", summary: "One point", supportingOutcomes: [outcome()], confidence: confidence(), rationale: ["One point"], metric: "revenue", direction: "stable", points: [{ at: new Date(), value: 1 }] }] } })).toThrow("at least two points");
    expect(() => new IntelligenceBuilder().build({ result: { ...base, forecasts: [{ title: "No assumptions", summary: "Invalid", supportingOutcomes: [outcome()], confidence: confidence(), rationale: ["Projection"], prediction: 1, horizon: { start: new Date("2026-01-01"), end: new Date("2026-02-01") } }] } })).toThrow("Forecast assumptions cannot be empty");
    expect(() => new IntelligenceBuilder().build({ result: base })).toThrow("report confidence is required");
  });
});

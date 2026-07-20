import { describe, expect, it } from "vitest";
import { ConfidenceScore } from "../../scoring";
import { confidence, intelligenceReport, outcome, policy, records } from "../learning-fixtures.test-support";
import { LearningBuilder } from "./learning-builder";

describe("LearningBuilder", () => {
  it("builds insights and proposal-only policy, scoring, and calibration artifacts", async () => {
    const result = await policy.learn({ records: records() }), report = new LearningBuilder().build({ result: result! });
    expect(report.insights[0].type).toBe("calibration");
    expect(report.policyImprovements[0]).toMatchObject({ targetPolicy: "confidence-policy", proposalStatus: "proposed" });
    expect(report.scoringImprovements[0]).toMatchObject({ targetModel: "confidence-score", proposalStatus: "proposed" });
    expect(report.confidenceCalibrations[0].adjustment).toBe(-10); expect(report.proposalCount).toBe(3);
  });
  it("preserves Outcome, Intelligence, and operational traceability", async () => {
    const report = new LearningBuilder().build({ result: (await policy.learn({ records: records() }))! });
    const explanation = report.policyImprovements[0].explainability;
    expect(explanation.supportingOutcomeIds[0].value).toBe("outcome-1"); expect(explanation.supportingIntelligenceIds[0].value).toBe("intelligence-1");
    expect(explanation.lineage.actionIds[0].value).toBe("action-1"); expect(explanation.rationale).toHaveLength(1);
  });
  it("propagates conservative artifact confidence", async () => {
    expect(new LearningBuilder().build({ result: (await policy.learn({ records: records() }))! }).confidence.score.value).toBe(75);
  });
  it("validates explainability and proposal structure", () => {
    const base = { reportingPeriod: { start: new Date(), end: new Date() }, summary: "Invalid" };
    expect(() => new LearningBuilder().build({ result: { ...base, confidence: confidence(), insights: [{ title: "No outcomes", summary: "Invalid", type: "other", supportingOutcomes: [], supportingIntelligence: [intelligenceReport()], rationale: ["None"], confidence: confidence() }] } })).toThrow("supporting Outcomes cannot be empty");
    expect(() => new LearningBuilder().build({ result: { ...base, confidence: confidence(), policyImprovements: [{ title: "No changes", summary: "Invalid", targetPolicy: "policy", proposedChanges: {}, supportingOutcomes: [outcome()], supportingIntelligence: [intelligenceReport()], assumptions: ["Test"], rationale: ["None"], confidence: confidence() }] } })).toThrow("changes cannot be empty");
    expect(() => new LearningBuilder().build({ result: { ...base, confidence: confidence(), scoringImprovements: [{ title: "No weight", summary: "Invalid", targetModel: "model", changes: [{ factor: "factor", operation: "reweight" }], supportingOutcomes: [outcome()], supportingIntelligence: [intelligenceReport()], assumptions: ["Test"], rationale: ["None"], confidence: confidence() }] } })).toThrow("requires a proposed weight");
    expect(() => new LearningBuilder().build({ result: { ...base, confidence: confidence(), confidenceCalibrations: [{ title: "No samples", summary: "Invalid", estimatedConfidence: ConfidenceScore.create(80), observedAccuracy: ConfidenceScore.create(70), recommendedConfidence: ConfidenceScore.create(75), sampleSize: 0, supportingOutcomes: [outcome()], supportingIntelligence: [intelligenceReport()], assumptions: ["Test"], rationale: ["None"], confidence: confidence() }] } })).toThrow("sample size must be a positive integer");
    expect(() => new LearningBuilder().build({ result: base })).toThrow("report confidence is required");
  });
});

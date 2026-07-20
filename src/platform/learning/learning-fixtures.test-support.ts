import { createInsightId, createIntelligenceReportId, Insight, IntelligenceCollection, IntelligenceReport } from "../intelligence";
import { Identifier } from "../kernel";
import { createOutcomeId, Outcome, OutcomeCollection, type OutcomeLineage } from "../outcomes";
import { ConfidenceAssessment, ConfidenceScore } from "../scoring";
import type { LearningPolicy } from "./application";

const id = (value: string) => Identifier.create(value);
export function confidence(score = 80) { return ConfidenceAssessment.create({ score: ConfidenceScore.create(score), rationale: [`Supported at ${score}.`] }); }
export function lineage(): OutcomeLineage { return { automationExecutionIds: [id("automation-1")], workflowIds: [id("workflow-1")], actionIds: [id("action-1")], decisionIds: [id("decision-1")], recommendationIds: [id("recommendation-1")], evaluationIds: [id("evaluation-1")], claimIds: [id("claim-1")], evidenceIds: [id("evidence-1")], observationIds: [id("observation-1")] }; }
export function outcome() { return Outcome.create({ id: createOutcomeId("outcome-1"), title: "Measured result", summary: "The execution result.", type: "action-outcome", status: "completed", successful: true, startedAt: new Date("2026-01-01"), completedAt: new Date("2026-06-30"), metrics: { accuracy: 72 }, lineage: lineage() }); }
export function intelligenceReport() {
  const source = outcome();
  const insight = Insight.create({ id: createInsightId("insight-1"), title: "Confidence pattern", summary: "Confidence exceeded observed accuracy.", confidence: confidence(85),
    explainability: { supportingOutcomeIds: [source.id], lineage: source.lineage, assumptions: ["Historical samples are representative."], rationale: ["Estimated confidence exceeded measured accuracy."] },
  });
  return IntelligenceReport.create({ id: createIntelligenceReportId("intelligence-1"), title: "Historical intelligence", summary: "Historical performance analysis.", reportingPeriod: { start: new Date("2026-01-01"), end: new Date("2026-06-30") }, insights: [insight], confidence: confidence(85) });
}
export function records() { return { outcomes: OutcomeCollection.create([outcome()]), intelligence: IntelligenceCollection.create([intelligenceReport()]) }; }
export const policy: LearningPolicy = {
  name: "historical-calibration", version: "1", supports: ({ records: value }) => !value.outcomes.isEmpty && !value.intelligence.isEmpty,
  learn({ records: value }) { const supportingOutcomes = value.outcomes.toArray(), supportingIntelligence = value.intelligence.toArray(); const rationale = ["Historical accuracy was below estimated confidence."]; const assumptions = ["The historical sample remains representative."];
    return { reportingPeriod: { start: new Date("2026-01-01"), end: new Date("2026-06-30") }, summary: "Learning proposals from historical performance.",
      insights: [{ title: "Confidence was optimistic", summary: "Estimates exceeded observed accuracy.", type: "calibration", supportingOutcomes, supportingIntelligence, assumptions, rationale, confidence: confidence(90) }],
      policyImprovements: [{ title: "Raise evidence threshold", summary: "Require more evidence before high confidence.", targetPolicy: "confidence-policy", proposedChanges: { minimumSamples: 30 }, expectedImpact: { accuracy: 5 }, supportingOutcomes, supportingIntelligence, assumptions, rationale, confidence: confidence(80) }],
      scoringImprovements: [{ title: "Reweight historical accuracy", summary: "Increase the historical accuracy factor.", targetModel: "confidence-score", changes: [{ factor: "historical-accuracy", operation: "reweight", currentWeight: 0.2, proposedWeight: 0.35 }], supportingOutcomes, supportingIntelligence, assumptions, rationale, confidence: confidence(75) }],
      confidenceCalibrations: [{ title: "Calibrate confidence downward", summary: "Align estimates with observed accuracy.", estimatedConfidence: ConfidenceScore.create(85), observedAccuracy: ConfidenceScore.create(72), recommendedConfidence: ConfidenceScore.create(75), sampleSize: 60, supportingOutcomes, supportingIntelligence, assumptions, rationale, confidence: confidence(85) }],
    };
  },
};

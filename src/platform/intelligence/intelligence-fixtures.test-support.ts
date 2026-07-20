import { Identifier } from "../kernel";
import { Outcome, OutcomeCollection, createOutcomeId, type OutcomeLineage } from "../outcomes";
import { ConfidenceAssessment, ConfidenceScore } from "../scoring";
import type { IntelligencePolicy } from "./application";

const id = (value: string) => Identifier.create(value);
export function confidence(score = 80) { return ConfidenceAssessment.create({ score: ConfidenceScore.create(score), rationale: [`Confidence is ${score}.`] }); }
export function lineage(): OutcomeLineage {
  return { automationExecutionIds: [id("automation-1")], workflowIds: [id("workflow-1")], actionIds: [id("action-1")], decisionIds: [id("decision-1")],
    recommendationIds: [id("recommendation-1")], evaluationIds: [id("evaluation-1")], claimIds: [id("claim-1")], evidenceIds: [id("evidence-1")], observationIds: [id("observation-1")],
  };
}
export function outcome() {
  return Outcome.create({ id: createOutcomeId("outcome-1"), title: "Revenue result", summary: "Revenue increased.", type: "action-outcome", status: "completed", successful: true,
    startedAt: new Date("2026-06-01T00:00:00Z"), completedAt: new Date("2026-06-30T00:00:00Z"), metrics: { revenue: 1200 }, result: { records: 30 }, lineage: lineage(),
  });
}
export function outcomes() { return OutcomeCollection.create([outcome()]); }
export const policy: IntelligencePolicy = {
  name: "performance-intelligence", version: "1", supports: ({ records }) => records.outcomes.isEmpty === false,
  analyze({ records }) {
    const supportingOutcomes = records.outcomes.toArray(), rationale = ["Measured Outcomes show a reproducible change."];
    return { title: "Performance report", summary: "Execution performance intelligence.", reportingPeriod: { start: new Date("2026-06-01T00:00:00Z"), end: new Date("2026-06-30T00:00:00Z") },
      insights: [{ title: "Performance improved", summary: "Measured performance improved.", supportingOutcomes, confidence: confidence(90), rationale, businessImpact: { revenue: 1200 } }],
      trends: [{ title: "Revenue trend", summary: "Revenue is increasing.", supportingOutcomes, confidence: confidence(85), rationale, metric: "revenue", direction: "increasing", points: [{ at: new Date("2026-06-01T00:00:00Z"), value: 1000 }, { at: new Date("2026-06-30T00:00:00Z"), value: 1200 }] }],
      opportunities: [{ title: "Growth opportunity", summary: "The measured pattern can be extended.", supportingOutcomes, confidence: confidence(80), rationale, expectedImpact: { revenue: 300 } }],
      forecasts: [{ title: "Revenue forecast", summary: "Revenue may continue growing.", supportingOutcomes, confidence: confidence(70), rationale, assumptions: ["Current operating conditions continue."], prediction: 1400, horizon: { start: new Date("2026-07-01T00:00:00Z"), end: new Date("2026-07-31T00:00:00Z") } }],
      anomalies: [{ title: "Revenue anomaly", summary: "Revenue exceeded the expected range.", supportingOutcomes, confidence: confidence(75), rationale, expected: 1000, actual: 1200, deviation: 200, explanation: "Actual revenue was 20% above the expected baseline." }],
    };
  },
};

import type { Identifier } from "../../kernel";

export type OutcomeLineage = Readonly<{
  automationExecutionIds: readonly Identifier[];
  workflowIds: readonly Identifier[];
  actionIds: readonly Identifier[];
  decisionIds: readonly Identifier[];
  recommendationIds: readonly Identifier[];
  evaluationIds: readonly Identifier[];
  claimIds: readonly Identifier[];
  evidenceIds: readonly Identifier[];
  observationIds: readonly Identifier[];
}>;
export function normalizeOutcomeLineage(value: OutcomeLineage): OutcomeLineage {
  return Object.freeze({
    automationExecutionIds: unique(value.automationExecutionIds), workflowIds: unique(value.workflowIds), actionIds: unique(value.actionIds),
    decisionIds: unique(value.decisionIds), recommendationIds: unique(value.recommendationIds), evaluationIds: unique(value.evaluationIds),
    claimIds: unique(value.claimIds), evidenceIds: unique(value.evidenceIds), observationIds: unique(value.observationIds),
  });
}
export function emptyOutcomeLineage(): OutcomeLineage {
  return normalizeOutcomeLineage({ automationExecutionIds: [], workflowIds: [], actionIds: [], decisionIds: [], recommendationIds: [], evaluationIds: [], claimIds: [], evidenceIds: [], observationIds: [] });
}
function unique(values: readonly Identifier[]): readonly Identifier[] {
  return Object.freeze([...new Map(values.map((value) => [value.value, value])).values()]);
}

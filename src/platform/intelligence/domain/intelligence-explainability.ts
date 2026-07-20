import type { OutcomeLineage, OutcomeId } from "../../outcomes";

export type IntelligenceExplainability = Readonly<{
  supportingOutcomeIds: readonly OutcomeId[];
  lineage: OutcomeLineage;
  assumptions: readonly string[];
  rationale: readonly string[];
}>;

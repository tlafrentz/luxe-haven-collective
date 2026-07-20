import type { IntelligenceReportId } from "../../intelligence";
import type { OutcomeId, OutcomeLineage } from "../../outcomes";

export type LearningExplainability = Readonly<{
  supportingOutcomeIds: readonly OutcomeId[];
  supportingIntelligenceIds: readonly IntelligenceReportId[];
  lineage: OutcomeLineage;
  assumptions: readonly string[];
  rationale: readonly string[];
}>;

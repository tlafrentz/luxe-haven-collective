import type { ActionCollection } from "@/platform/actions";
import type { DecisionCollection } from "@/platform/decisions";
import type { IntelligenceCollection } from "@/platform/intelligence";
import type { OutcomeCollection } from "@/platform/outcomes";
import type { RecommendationCollection } from "@/platform/recommendations";

export type ExecutivePlatformInputs = Readonly<{
  recommendations: RecommendationCollection;
  decisions: DecisionCollection;
  actions: ActionCollection;
  outcomes: OutcomeCollection;
  intelligence: IntelligenceCollection;
}>;

/** The only domain input accepted by canonical Executive orchestration. */
export function normalizeExecutiveInputs(input: ExecutivePlatformInputs): ExecutivePlatformInputs {
  return Object.freeze({ ...input });
}

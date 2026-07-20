import {
  Decision,
  type DecisionInput,
} from "../domain/decision";
import type {
  DecisionOutcome,
} from "../domain/decision-outcome";

/**
 * Functional construction API for callers that already have all inputs.
 */
export function buildDecision<
  TOutcome extends DecisionOutcome,
>(
  input: DecisionInput<TOutcome>,
): Decision<TOutcome> {
  return Decision.create(input);
}

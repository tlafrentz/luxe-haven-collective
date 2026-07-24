import type { OutcomeStatus } from "./outcome-model";

export type OutcomeDomainErrorCode =
  | "OUTCOME_INPUT_INVALID" | "OUTCOME_INVALID_TRANSITION" | "OUTCOME_EXPECTATION_INVALID"
  | "OUTCOME_MEASUREMENT_INVALID" | "OUTCOME_WINDOW_INVALID" | "OUTCOME_EVIDENCE_INSUFFICIENT"
  | "OUTCOME_COLLECTION_LIMIT" | "OUTCOME_IMMUTABLE" | "OUTCOME_DUPLICATE";

export class OutcomeDomainError extends Error {
  public constructor(
    public readonly code: OutcomeDomainErrorCode,
    message: string,
    public readonly details?: Readonly<{ field?: string; from?: OutcomeStatus; to?: OutcomeStatus; referenceId?: string }>,
  ) {
    super(message);
    this.name = "OutcomeDomainError";
  }
}

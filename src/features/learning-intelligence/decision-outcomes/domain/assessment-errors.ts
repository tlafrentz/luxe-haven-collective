export type DecisionOutcomeErrorCode =
  | "OUTCOME_NOT_EVALUABLE" | "POLICY_INVALID" | "COMPARISON_INCOMPATIBLE"
  | "ASSESSMENT_VERSION_CONFLICT" | "ASSESSMENT_NOT_AUTHORIZED"
  | "OUTCOME_NOT_FOUND" | "ASSESSMENT_REPOSITORY_UNAVAILABLE";

export class DecisionOutcomeError extends Error {
  public constructor(public readonly code: DecisionOutcomeErrorCode, message: string) {
    super(message);
    this.name = "DecisionOutcomeError";
  }
}

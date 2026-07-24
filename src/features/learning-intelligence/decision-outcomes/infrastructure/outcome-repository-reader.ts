import type { ResultType } from "@/platform/kernel";
import type { OutcomeId, OutcomeOwnerId, OutcomeState } from "../../outcomes";
import type { OutcomeRepository } from "../../outcomes";
import type { DecisionOutcomeOutcomeReader, DecisionOutcomeRepositoryError } from "../application";

export class OutcomeRepositoryDecisionOutcomeReader implements DecisionOutcomeOutcomeReader {
  public constructor(private readonly outcomes: OutcomeRepository) {}
  public async getOutcome(ownerId: OutcomeOwnerId, outcomeId: OutcomeId): Promise<ResultType<OutcomeState | null, DecisionOutcomeRepositoryError>> {
    const result = await this.outcomes.findById(ownerId, outcomeId);
    if (result.isFailure) return { isSuccess: false, isFailure: true, error: { code: "ASSESSMENT_REPOSITORY_UNAVAILABLE", retryable: result.error.code === "OUTCOME_REPOSITORY_UNAVAILABLE" && result.error.retryable } };
    return { isSuccess: true, isFailure: false, value: result.value?.props ?? null };
  }
}

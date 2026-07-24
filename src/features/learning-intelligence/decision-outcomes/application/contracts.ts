import type { ResultType } from "@/platform/kernel";
import type { OutcomeId, OutcomeOwnerId, OutcomeState } from "../../outcomes";
import type { DecisionOutcomeAssessment, DecisionOutcomeAssessmentId } from "../domain";

export type DecisionOutcomeRepositoryError =
  | Readonly<{ code: "ASSESSMENT_VERSION_CONFLICT"; currentVersion?: number }>
  | Readonly<{ code: "ASSESSMENT_DUPLICATE_ID" }>
  | Readonly<{ code: "ASSESSMENT_REPOSITORY_UNAVAILABLE"; retryable: boolean }>;

export interface DecisionOutcomeAssessmentRepository {
  findById(ownerId: OutcomeOwnerId, assessmentId: DecisionOutcomeAssessmentId): Promise<ResultType<DecisionOutcomeAssessment | null, DecisionOutcomeRepositoryError>>;
  findLatestByOutcome(ownerId: OutcomeOwnerId, outcomeId: OutcomeId): Promise<ResultType<DecisionOutcomeAssessment | null, DecisionOutcomeRepositoryError>>;
  save(assessment: DecisionOutcomeAssessment, expectedVersion: number | null): Promise<ResultType<void, DecisionOutcomeRepositoryError>>;
}
export interface DecisionOutcomeOutcomeReader {
  getOutcome(ownerId: OutcomeOwnerId, outcomeId: OutcomeId): Promise<ResultType<OutcomeState | null, DecisionOutcomeRepositoryError>>;
}
export interface DecisionOutcomeAuthorization {
  canEvaluateOutcome(ownerId: OutcomeOwnerId, outcomeId: OutcomeId): Promise<boolean>;
  canReadAssessment(ownerId: OutcomeOwnerId, assessmentId: DecisionOutcomeAssessmentId): Promise<boolean>;
}
export type DecisionOutcomeApplicationError =
  | Readonly<{ code: "ASSESSMENT_NOT_AUTHORIZED" }>
  | Readonly<{ code: "OUTCOME_NOT_FOUND" }>
  | Readonly<{ code: "OUTCOME_NOT_EVALUABLE"; reason?: string }>
  | Readonly<{ code: "ASSESSMENT_VERSION_CONFLICT"; currentVersion?: number }>
  | Readonly<{ code: "ASSESSMENT_REPOSITORY_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "ASSESSMENT_UNEXPECTED"; correlationId?: string }>;

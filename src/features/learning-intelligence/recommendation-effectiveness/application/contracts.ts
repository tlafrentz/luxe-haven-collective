import type { ResultType } from "@/platform/kernel";
import type { DecisionOutcomeAssessment, DecisionOutcomeAssessmentId } from "../../decision-outcomes";
import type { OutcomeOwnerId } from "../../outcomes";
import type {
  RecommendationEffectivenessAssessment, RecommendationEffectivenessAssessmentId,
  RecommendationInstance, RecommendationTypeId,
} from "../domain";

export type RecommendationInstanceReference = Omit<RecommendationInstance, "assessment">;
export type RecommendationEffectivenessRepositoryError =
  | Readonly<{ code: "RECOMMENDATION_EFFECTIVENESS_VERSION_CONFLICT"; currentVersion?: number }>
  | Readonly<{ code: "RECOMMENDATION_EFFECTIVENESS_DUPLICATE_ID" }>
  | Readonly<{ code: "RECOMMENDATION_EFFECTIVENESS_REPOSITORY_UNAVAILABLE"; retryable: boolean }>;
export interface RecommendationEffectivenessRepository {
  save(assessment: RecommendationEffectivenessAssessment, expectedVersion: number | null): Promise<ResultType<void, RecommendationEffectivenessRepositoryError>>;
  findLatest(ownerId: OutcomeOwnerId, recommendationType: RecommendationTypeId): Promise<ResultType<RecommendationEffectivenessAssessment | null, RecommendationEffectivenessRepositoryError>>;
  findById(ownerId: OutcomeOwnerId, assessmentId: RecommendationEffectivenessAssessmentId): Promise<ResultType<RecommendationEffectivenessAssessment | null, RecommendationEffectivenessRepositoryError>>;
}
export interface RecommendationEffectivenessRecommendationReader {
  listCompletedInstances(ownerId: OutcomeOwnerId, recommendationType: RecommendationTypeId, limit: number): Promise<ResultType<readonly RecommendationInstanceReference[], RecommendationEffectivenessRepositoryError>>;
}
export interface RecommendationEffectivenessOutcomeAssessmentReader {
  findAssessments(ownerId: OutcomeOwnerId, assessmentIds: readonly DecisionOutcomeAssessmentId[]): Promise<ResultType<readonly DecisionOutcomeAssessment[], RecommendationEffectivenessRepositoryError>>;
}
export interface RecommendationEffectivenessAuthorization {
  canEvaluateRecommendationType(ownerId: OutcomeOwnerId, recommendationType: RecommendationTypeId): Promise<boolean>;
}
export type RecommendationEffectivenessEvent = Readonly<{
  eventId: string;
  ownerId: OutcomeOwnerId;
  recommendationType: RecommendationTypeId;
  assessmentId: RecommendationEffectivenessAssessmentId;
  occurredAt: Date;
  type: "RecommendationEffectivenessEvaluated" | "RecommendationEffectivenessImproved" | "RecommendationEffectivenessDeclined" | "RecommendationReadyForLearning";
  references: Readonly<Record<string, string | number | boolean>>;
}>;
export interface RecommendationEffectivenessEventSink {
  publish(event: RecommendationEffectivenessEvent): Promise<void>;
}
export type RecommendationEffectivenessApplicationError =
  | Readonly<{ code: "RECOMMENDATION_EFFECTIVENESS_NOT_AUTHORIZED" }>
  | Readonly<{ code: "RECOMMENDATION_EFFECTIVENESS_INPUT_INVALID"; reason?: string }>
  | Readonly<{ code: "RECOMMENDATION_OUTCOME_ASSESSMENT_MISSING"; assessmentId?: string }>
  | Readonly<{ code: "RECOMMENDATION_EFFECTIVENESS_VERSION_CONFLICT"; currentVersion?: number }>
  | Readonly<{ code: "RECOMMENDATION_EFFECTIVENESS_REPOSITORY_UNAVAILABLE"; retryable: boolean }>
  | Readonly<{ code: "RECOMMENDATION_EFFECTIVENESS_UNEXPECTED"; correlationId?: string }>;

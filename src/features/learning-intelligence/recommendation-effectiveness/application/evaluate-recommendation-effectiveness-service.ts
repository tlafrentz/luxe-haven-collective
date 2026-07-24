import { Result, type ResultType } from "@/platform/kernel";
import type { OutcomeOwnerId } from "../../outcomes";
import {
  compareRecommendationEffectiveness, evaluateRecommendationEffectiveness,
  type RecommendationEffectivenessAssessment, type RecommendationEffectivenessAssessmentId,
  type RecommendationEffectivenessPolicy, type RecommendationTypeId,
} from "../domain";
import type {
  RecommendationEffectivenessApplicationError, RecommendationEffectivenessAuthorization,
  RecommendationEffectivenessEvent, RecommendationEffectivenessEventSink,
  RecommendationEffectivenessOutcomeAssessmentReader, RecommendationEffectivenessRecommendationReader,
  RecommendationEffectivenessRepository, RecommendationEffectivenessRepositoryError,
} from "./contracts";

export type EvaluateRecommendationEffectivenessQuery = Readonly<{
  ownerId: OutcomeOwnerId;
  recommendationType: RecommendationTypeId;
  assessmentId: RecommendationEffectivenessAssessmentId;
  policy: RecommendationEffectivenessPolicy;
  evaluatedAt: Date;
  expectedVersion: number | null;
  instanceLimit: number;
  eventId: string;
  correlationId?: string;
}>;
type Dependencies = Readonly<{
  recommendations: RecommendationEffectivenessRecommendationReader;
  outcomeAssessments: RecommendationEffectivenessOutcomeAssessmentReader;
  repository: RecommendationEffectivenessRepository;
  authorization: RecommendationEffectivenessAuthorization;
  events?: RecommendationEffectivenessEventSink;
}>;

export async function evaluateRecommendationEffectivenessService(
  dependencies: Dependencies,
  query: EvaluateRecommendationEffectivenessQuery,
): Promise<ResultType<RecommendationEffectivenessAssessment, RecommendationEffectivenessApplicationError>> {
  if (!await dependencies.authorization.canEvaluateRecommendationType(query.ownerId, query.recommendationType)) return Result.fail({ code: "RECOMMENDATION_EFFECTIVENESS_NOT_AUTHORIZED" });
  if (!Number.isInteger(query.instanceLimit) || query.instanceLimit < 1 || query.instanceLimit > 1000) return Result.fail({ code: "RECOMMENDATION_EFFECTIVENESS_INPUT_INVALID", reason: "Instance limit must be between 1 and 1000." });
  const references = await dependencies.recommendations.listCompletedInstances(query.ownerId, query.recommendationType, query.instanceLimit);
  if (references.isFailure) return Result.fail(mapRepository(references.error));
  const assessments = await dependencies.outcomeAssessments.findAssessments(query.ownerId, references.value.map(value => value.outcomeAssessmentId));
  if (assessments.isFailure) return Result.fail(mapRepository(assessments.error));
  const byId = new Map(assessments.value.map(value => [value.id.value, value]));
  const missing = references.value.find(value => !byId.has(value.outcomeAssessmentId.value));
  if (missing) return Result.fail({ code: "RECOMMENDATION_OUTCOME_ASSESSMENT_MISSING", assessmentId: missing.outcomeAssessmentId.value });
  const previous = await dependencies.repository.findLatest(query.ownerId, query.recommendationType);
  if (previous.isFailure) return Result.fail(mapRepository(previous.error));
  if ((previous.value?.version ?? null) !== query.expectedVersion) return Result.fail({ code: "RECOMMENDATION_EFFECTIVENESS_VERSION_CONFLICT", ...(previous.value ? { currentVersion: previous.value.version } : {}) });
  try {
    const assessment = evaluateRecommendationEffectiveness({
      assessmentId: query.assessmentId, ownerId: query.ownerId, recommendationType: query.recommendationType,
      instances: references.value.map(reference => Object.freeze({ ...reference, assessment: byId.get(reference.outcomeAssessmentId.value)! })),
      policy: query.policy, evaluatedAt: query.evaluatedAt, ...(previous.value ? { previousAssessment: previous.value } : {}),
    });
    const saved = await dependencies.repository.save(assessment, query.expectedVersion);
    if (saved.isFailure) return Result.fail(mapRepository(saved.error));
    if (dependencies.events) await dependencies.events.publish(eventFor(query, assessment, previous.value));
    return Result.ok(assessment);
  } catch (error) {
    return Result.fail({ code: "RECOMMENDATION_EFFECTIVENESS_INPUT_INVALID", reason: error instanceof Error ? error.message : undefined });
  }
}
function eventFor(query: EvaluateRecommendationEffectivenessQuery, current: RecommendationEffectivenessAssessment, previous: RecommendationEffectivenessAssessment | null): RecommendationEffectivenessEvent {
  const comparison = previous ? compareRecommendationEffectiveness(previous, current) : null;
  const type = current.learningReadiness === "ready" ? "RecommendationReadyForLearning"
    : comparison?.classification === "improved" ? "RecommendationEffectivenessImproved"
    : comparison?.classification === "declined" ? "RecommendationEffectivenessDeclined"
    : "RecommendationEffectivenessEvaluated";
  return Object.freeze({
    eventId: query.eventId, ownerId: query.ownerId, recommendationType: query.recommendationType,
    assessmentId: current.id, occurredAt: new Date(query.evaluatedAt), type,
    references: Object.freeze({ effectiveness: current.overall.effectiveness, policyVersion: current.policyVersion, sampleSize: current.outcomeDistribution.totalEvaluated }),
  });
}
function mapRepository(error: RecommendationEffectivenessRepositoryError): RecommendationEffectivenessApplicationError {
  if (error.code === "RECOMMENDATION_EFFECTIVENESS_VERSION_CONFLICT") return error;
  if (error.code === "RECOMMENDATION_EFFECTIVENESS_REPOSITORY_UNAVAILABLE") return error;
  return { code: "RECOMMENDATION_EFFECTIVENESS_UNEXPECTED" };
}

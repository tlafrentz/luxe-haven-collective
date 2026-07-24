import { Result, type ResultType } from "@/platform/kernel";
import type { OutcomeOwnerId } from "../../outcomes";
import type { RecommendationEffectivenessRepository, RecommendationEffectivenessRepositoryError } from "../application";
import type { RecommendationEffectivenessAssessment, RecommendationEffectivenessAssessmentId, RecommendationTypeId } from "../domain";

export class InMemoryRecommendationEffectivenessRepository implements RecommendationEffectivenessRepository {
  private readonly records = new Map<string, RecommendationEffectivenessAssessment>();
  public async save(value: RecommendationEffectivenessAssessment, expectedVersion: number | null): Promise<ResultType<void, RecommendationEffectivenessRepositoryError>> {
    if (this.records.has(value.id.value)) return Result.fail({ code: "RECOMMENDATION_EFFECTIVENESS_DUPLICATE_ID" });
    const latest = this.latest(value.ownerId, value.recommendationType);
    if ((latest?.version ?? null) !== expectedVersion || value.version !== (expectedVersion ?? 0) + 1) return Result.fail({ code: "RECOMMENDATION_EFFECTIVENESS_VERSION_CONFLICT", ...(latest ? { currentVersion: latest.version } : {}) });
    this.records.set(value.id.value, clone(value));
    return Result.ok(undefined);
  }
  public async findLatest(ownerId: OutcomeOwnerId, recommendationType: RecommendationTypeId): Promise<ResultType<RecommendationEffectivenessAssessment | null, RecommendationEffectivenessRepositoryError>> {
    return Result.ok(this.latest(ownerId, recommendationType) ? clone(this.latest(ownerId, recommendationType)!) : null);
  }
  public async findById(ownerId: OutcomeOwnerId, id: RecommendationEffectivenessAssessmentId): Promise<ResultType<RecommendationEffectivenessAssessment | null, RecommendationEffectivenessRepositoryError>> {
    const value = this.records.get(id.value);
    return Result.ok(value && value.ownerId.equals(ownerId) ? clone(value) : null);
  }
  private latest(ownerId: OutcomeOwnerId, type: RecommendationTypeId) {
    return [...this.records.values()].filter(value => value.ownerId.equals(ownerId) && value.recommendationType.equals(type))
      .sort((a, b) => b.version - a.version || b.evaluatedAt.getTime() - a.evaluatedAt.getTime() || b.id.value.localeCompare(a.id.value))[0];
  }
}
function clone(value: RecommendationEffectivenessAssessment): RecommendationEffectivenessAssessment {
  return Object.freeze({ ...value, evaluatedAt: new Date(value.evaluatedAt), applicability: Object.freeze([...value.applicability]), lineage: Object.freeze({ ...value.lineage, recommendationIds: Object.freeze([...value.lineage.recommendationIds]), decisionIds: Object.freeze([...value.lineage.decisionIds]), outcomeIds: Object.freeze([...value.lineage.outcomeIds]), outcomeAssessmentIds: Object.freeze([...value.lineage.outcomeAssessmentIds]) }) });
}

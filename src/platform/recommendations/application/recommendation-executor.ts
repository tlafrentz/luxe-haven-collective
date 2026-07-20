import type { EvaluationCollection } from "../../evaluations";
import {
  ExecutionStatus,
  type Executor,
} from "../../execution";
import type { ObservationValue } from "../../observations";
import {
  RecommendationCollection,
  type RecommendationId,
} from "../domain";
import { RecommendationBuilder } from "./recommendation-builder";
import type { RecommendationPolicy } from "./recommendation-policy";
import { RecommendationPolicyRegistry } from "./recommendation-policy-registry";
import { RecommendationSession } from "./recommendation-session";

export type RecommendationExecutionInput = Readonly<{
  evaluations: EvaluationCollection;
  registry?: RecommendationPolicyRegistry;
  metadata?: Readonly<Record<string, ObservationValue>>;
  now?: () => Date;
  createRecommendationId?: (policy: RecommendationPolicy) => RecommendationId;
}>;

/** Side-effect-free orchestration of registered recommendation policies. */
export class RecommendationExecutor implements Executor<
  RecommendationExecutionInput,
  RecommendationSession
> {
  public constructor(
    private readonly registry?: RecommendationPolicyRegistry,
    private readonly builder = new RecommendationBuilder(),
  ) {}

  public async execute(input: RecommendationExecutionInput): Promise<RecommendationSession> {
    const registry = input.registry ?? this.registry;
    if (!registry) throw new TypeError("A Recommendation policy registry is required.");
    const now = input.now ?? (() => new Date());
    const startedAt = validDate(now(), "Recommendation execution start date");
    let recommendations = RecommendationCollection.empty();
    const warnings: string[] = [];
    const errors: string[] = [];
    const skippedItems: string[] = [];
    const exceptions: string[] = [];

    for (const policy of registry) {
      try {
        const context = { evaluations: input.evaluations };
        if (!(await policy.supports(context))) {
          skippedItems.push(policy.name);
          continue;
        }
        const result = await policy.recommend(context);
        if (!result) {
          skippedItems.push(policy.name);
          warnings.push(`Recommendation policy "${policy.name}" produced no Recommendation.`);
          continue;
        }
        recommendations = recommendations.add(this.builder.build({
          result,
          ...(input.createRecommendationId
            ? { id: input.createRecommendationId(policy) }
            : {}),
          metadata: {
            policy: policy.name,
            ...(policy.version ? { policyVersion: policy.version } : {}),
          },
        }));
      } catch (error) {
        errors.push(`Recommendation policy "${policy.name}" failed: ${errorMessage(error)}`);
        exceptions.push(policy.name);
      }
    }

    const completedAt = validDate(now(), "Recommendation execution completion date");
    const failed = exceptions.length;
    const status = failed > 0
      ? (recommendations.isEmpty ? ExecutionStatus.FAILED : ExecutionStatus.COMPLETED_WITH_WARNINGS)
      : (warnings.length > 0 ? ExecutionStatus.COMPLETED_WITH_WARNINGS : ExecutionStatus.COMPLETED);

    return RecommendationSession.create({
      recommendations,
      status,
      statistics: {
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        processed: registry.size,
        succeeded: recommendations.size,
        skipped: skippedItems.length,
        failed,
      },
      diagnostics: { warnings, errors, skippedItems, exceptions },
      metadata: input.metadata,
    });
  }
}

function validDate(value: Date, field: string): Date {
  const copy = new Date(value);
  if (Number.isNaN(copy.getTime())) throw new TypeError(`${field} must be valid.`);
  return copy;
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

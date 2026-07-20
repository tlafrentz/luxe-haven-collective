import { ExecutionStatus, type Executor } from "../../execution";
import type { ObservationValue } from "../../observations";
import type { RecommendationCollection } from "../../recommendations";
import { DecisionCollection } from "../domain/decision-collection";
import type { Identifier } from "../../kernel";
import { DecisionBuilder } from "./decision-builder";
import type { DecisionPolicy } from "./decision-policy";
import { DecisionPolicyRegistry } from "./decision-policy-registry";
import { DecisionSession } from "./decision-session";

export type DecisionExecutionInput = Readonly<{
  recommendations: RecommendationCollection;
  registry?: DecisionPolicyRegistry;
  metadata?: Readonly<Record<string, ObservationValue>>;
  now?: () => Date;
  createDecisionId?: (policy: DecisionPolicy) => Identifier;
}>;

export class DecisionExecutor implements Executor<DecisionExecutionInput, DecisionSession> {
  public constructor(
    private readonly registry?: DecisionPolicyRegistry,
    private readonly builder = DecisionBuilder.create(),
  ) {}

  public async execute(input: DecisionExecutionInput): Promise<DecisionSession> {
    const registry = input.registry ?? this.registry;
    if (!registry) throw new TypeError("A Decision policy registry is required.");
    const now = input.now ?? (() => new Date());
    const startedAt = validDate(now(), "Decision execution start date");
    let decisions = DecisionCollection.empty();
    const warnings: string[] = [];
    const errors: string[] = [];
    const skippedItems: string[] = [];
    const exceptions: string[] = [];

    for (const policy of registry) {
      try {
        const context = { recommendations: input.recommendations };
        if (!(await policy.supports(context))) {
          skippedItems.push(policy.name);
          continue;
        }
        const result = await policy.decide(context);
        if (!result) {
          skippedItems.push(policy.name);
          warnings.push(`Decision policy "${policy.name}" produced no Decision.`);
          continue;
        }
        decisions = decisions.add(this.builder.buildFromPolicy({
          result,
          decidedAt: validDate(now(), "Decision date"),
          ...(input.createDecisionId ? { id: input.createDecisionId(policy) } : {}),
          metadata: {
            policy: policy.name,
            ...(policy.version ? { policyVersion: policy.version } : {}),
          },
        }));
      } catch (error) {
        errors.push(`Decision policy "${policy.name}" failed: ${errorMessage(error)}`);
        exceptions.push(policy.name);
      }
    }

    const completedAt = validDate(now(), "Decision execution completion date");
    const failed = exceptions.length;
    const status = failed > 0
      ? (decisions.isEmpty ? ExecutionStatus.FAILED : ExecutionStatus.COMPLETED_WITH_WARNINGS)
      : (warnings.length > 0 ? ExecutionStatus.COMPLETED_WITH_WARNINGS : ExecutionStatus.COMPLETED);

    return DecisionSession.create({
      decisions,
      status,
      statistics: {
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        processed: registry.size,
        succeeded: decisions.size,
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

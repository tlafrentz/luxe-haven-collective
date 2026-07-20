import { ExecutionStatus, type Executor } from "../../execution";
import type { ObservationValue } from "../../observations";
import { LearningCollection, type LearningReportId } from "../domain";
import { LearningBuilder } from "./learning-builder";
import type { LearningPolicy, LearningRecordSet } from "./learning-policy";
import { LearningPolicyRegistry } from "./learning-policy-registry";
import { LearningSession } from "./learning-session";

export type LearningExecutorInput = Readonly<{ records: LearningRecordSet; registry?: LearningPolicyRegistry; now?: () => Date; createReportId?: (policy: LearningPolicy) => LearningReportId; metadata?: Readonly<Record<string, ObservationValue>> }>;
export class LearningExecutor implements Executor<LearningExecutorInput, LearningSession> {
  public constructor(private readonly registry?: LearningPolicyRegistry, private readonly builder = new LearningBuilder()) {}
  public async execute(input: LearningExecutorInput): Promise<LearningSession> { const registry = input.registry ?? this.registry; if (!registry) throw new TypeError("A Learning policy registry is required."); const now = input.now ?? (() => new Date()), startedAt = date(now(), "Learning execution start date"); let learning = LearningCollection.empty(); const warnings: string[] = [], errors: string[] = [], skippedItems: string[] = [], exceptions: string[] = [];
    for (const policy of registry) { try { const context = { records: input.records }; if (!(await policy.supports(context))) { skippedItems.push(policy.name); continue; } const result = await policy.learn(context); if (!result) { skippedItems.push(policy.name); warnings.push(`Learning policy "${policy.name}" produced no report.`); continue; } learning = learning.add(this.builder.build({ result, ...(input.createReportId ? { id: input.createReportId(policy) } : {}), metadata: { policy: policy.name, ...(policy.version ? { policyVersion: policy.version } : {}) } })); } catch (error) { errors.push(`Learning policy "${policy.name}" failed: ${error instanceof Error ? error.message : String(error)}`); exceptions.push(policy.name); } }
    const completedAt = date(now(), "Learning execution completion date"), failed = exceptions.length; const status = failed ? (learning.isEmpty ? ExecutionStatus.FAILED : ExecutionStatus.COMPLETED_WITH_WARNINGS) : (warnings.length ? ExecutionStatus.COMPLETED_WITH_WARNINGS : ExecutionStatus.COMPLETED);
    return LearningSession.create({ learning, status, statistics: { startedAt, completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), processed: registry.size, succeeded: learning.size, skipped: skippedItems.length, failed }, diagnostics: { warnings, errors, skippedItems, exceptions }, metadata: input.metadata });
  }
}
function date(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`); return result; }

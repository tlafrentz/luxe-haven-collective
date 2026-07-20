import { ExecutionStatus, type Executor } from "../../execution";
import type { ObservationValue } from "../../observations";
import { IntelligenceCollection, type IntelligenceReportId } from "../domain";
import { IntelligenceBuilder } from "./intelligence-builder";
import type { IntelligencePolicy, IntelligenceRecordSet } from "./intelligence-policy";
import { IntelligencePolicyRegistry } from "./intelligence-policy-registry";
import { IntelligenceSession } from "./intelligence-session";

export type IntelligenceExecutorInput = Readonly<{ records: IntelligenceRecordSet; registry?: IntelligencePolicyRegistry; now?: () => Date; createReportId?: (policy: IntelligencePolicy) => IntelligenceReportId; metadata?: Readonly<Record<string, ObservationValue>> }>;
export class IntelligenceExecutor implements Executor<IntelligenceExecutorInput, IntelligenceSession> {
  public constructor(private readonly registry?: IntelligencePolicyRegistry, private readonly builder = new IntelligenceBuilder()) {}
  public async execute(input: IntelligenceExecutorInput): Promise<IntelligenceSession> {
    const registry = input.registry ?? this.registry; if (!registry) throw new TypeError("An Intelligence policy registry is required.");
    const now = input.now ?? (() => new Date()), startedAt = date(now(), "Intelligence execution start date");
    let intelligence = IntelligenceCollection.empty(); const warnings: string[] = [], errors: string[] = [], skippedItems: string[] = [], exceptions: string[] = [];
    for (const policy of registry) {
      try {
        const context = { records: input.records };
        if (!(await policy.supports(context))) { skippedItems.push(policy.name); continue; }
        const result = await policy.analyze(context);
        if (!result) { skippedItems.push(policy.name); warnings.push(`Intelligence policy "${policy.name}" produced no report.`); continue; }
        intelligence = intelligence.add(this.builder.build({ result, ...(input.createReportId ? { id: input.createReportId(policy) } : {}), metadata: { policy: policy.name, ...(policy.version ? { policyVersion: policy.version } : {}) } }));
      } catch (error) { errors.push(`Intelligence policy "${policy.name}" failed: ${error instanceof Error ? error.message : String(error)}`); exceptions.push(policy.name); }
    }
    const completedAt = date(now(), "Intelligence execution completion date"), failed = exceptions.length;
    const status = failed ? (intelligence.isEmpty ? ExecutionStatus.FAILED : ExecutionStatus.COMPLETED_WITH_WARNINGS) : (warnings.length ? ExecutionStatus.COMPLETED_WITH_WARNINGS : ExecutionStatus.COMPLETED);
    return IntelligenceSession.create({ intelligence, status,
      statistics: { startedAt, completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), processed: registry.size, succeeded: intelligence.size, skipped: skippedItems.length, failed },
      diagnostics: { warnings, errors, skippedItems, exceptions }, metadata: input.metadata,
    });
  }
}
function date(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`); return result; }

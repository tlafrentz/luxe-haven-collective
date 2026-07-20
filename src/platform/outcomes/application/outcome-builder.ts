import type { Action } from "../../actions";
import type { Identifier } from "../../kernel";
import { createOutcomeId, emptyOutcomeLineage, Outcome, type OutcomeId, type OutcomeLineage } from "../domain";
import type { ObservationValue } from "../../observations";
import type { OutcomePolicyResult, OutcomeSource } from "./outcome-policy";

export type OutcomeBuilderInput = Readonly<{
  source: OutcomeSource;
  result: OutcomePolicyResult;
  id?: OutcomeId;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;
export class OutcomeBuilder {
  public build(input: OutcomeBuilderInput): Outcome {
    const timing = sourceTiming(input.source);
    const duration = timing.completedAt ? timing.completedAt.getTime() - timing.startedAt.getTime() : undefined;
    const timedOut = input.result.timeoutMs !== undefined && duration !== undefined && duration > positiveTimeout(input.result.timeoutMs);
    const lineage = mergeLineage(deriveLineage(input.source), input.result.lineage);
    validateTraceability(lineage);
    return Outcome.create({
      id: input.id ?? createOutcomeId(), title: input.result.title, summary: input.result.summary,
      type: input.result.type ?? `${input.source.type}-outcome`,
      status: timedOut ? "timed-out" : input.result.status,
      successful: timedOut ? false : input.result.successful,
      startedAt: timing.startedAt, ...(timing.completedAt ? { completedAt: timing.completedAt } : {}),
      metrics: { ...(duration !== undefined ? { durationMs: duration } : {}), ...input.result.metrics },
      result: input.result.result, notes: input.result.notes, lineage,
      metadata: { ...input.result.metadata, ...input.metadata },
    });
  }
}
export class OutcomeTraceabilityError extends Error {
  public readonly missingLevels: readonly string[];
  public constructor(missing: readonly string[]) {
    super(`Outcome lineage is incomplete. Missing: ${missing.join(", ")}.`);
    this.name = "OutcomeTraceabilityError"; this.missingLevels = Object.freeze([...missing]);
  }
}
function sourceTiming(source: OutcomeSource): { startedAt: Date; completedAt?: Date } {
  if (source.type === "action") return { startedAt: source.action.startedAt ?? source.action.acceptedAt ?? source.action.createdAt, ...(source.action.completedAt ? { completedAt: source.action.completedAt } : {}) };
  if (source.type === "automation") return { startedAt: source.automation.startedAt, completedAt: source.automation.completedAt };
  const first = source.workflow.history[0], last = source.workflow.history[source.workflow.history.length - 1];
  const terminal = source.workflow.status === "completed" || source.workflow.status === "cancelled";
  return { startedAt: first.recordedAt, ...(terminal ? { completedAt: last.recordedAt } : {}) };
}
function deriveLineage(source: OutcomeSource): OutcomeLineage {
  const empty = emptyOutcomeLineage();
  if (source.type === "action") return { ...empty, actionIds: [source.action.id], decisionIds: source.action.decisionIds };
  if (source.type === "workflow") return fromWorkflow(source.workflow.id, source.workflow.steps.flatMap((step) => step.actions.toArray()));
  const workflows = source.automation.executedWorkflows.toArray();
  const directActions = source.automation.executedActions.toArray();
  const workflowActions = workflows.flatMap((workflow) => workflow.steps.flatMap((step) => step.actions.toArray()));
  const actions = [...directActions, ...workflowActions];
  return mergeLineage({ ...empty, automationExecutionIds: [source.automation.id] },
    mergeLineage(...workflows.map((workflow) => fromWorkflow(workflow.id, workflow.steps.flatMap((step) => step.actions.toArray()))),
      { ...empty, actionIds: actions.map((action) => action.id), decisionIds: actions.flatMap((action) => action.decisionIds) }));
}
function fromWorkflow(id: Identifier, actions: readonly Action[]): OutcomeLineage {
  return { ...emptyOutcomeLineage(), workflowIds: [id], actionIds: actions.map((action) => action.id), decisionIds: actions.flatMap((action) => action.decisionIds) };
}
function mergeLineage(...values: readonly OutcomeLineage[]): OutcomeLineage {
  const result = emptyOutcomeLineage();
  const entries = Object.keys(result).map((key) => {
    const identifiers = values.flatMap((value) => value[key as keyof OutcomeLineage]);
    return [key, [...new Map(identifiers.map((id) => [id.value, id])).values()]];
  });
  return Object.freeze(Object.fromEntries(entries)) as OutcomeLineage;
}
function validateTraceability(value: OutcomeLineage): void {
  if (value.actionIds.length === 0) return;
  const required: readonly (keyof OutcomeLineage)[] = ["decisionIds", "recommendationIds", "evaluationIds", "claimIds", "evidenceIds", "observationIds"];
  const missing = required.filter((key) => value[key].length === 0).map((key) => key.replace(/Ids$/, ""));
  if (missing.length) throw new OutcomeTraceabilityError(missing);
}
function positiveTimeout(value: number): number { if (!Number.isFinite(value) || value < 0) throw new RangeError("Outcome timeout must be a non-negative finite number."); return value; }

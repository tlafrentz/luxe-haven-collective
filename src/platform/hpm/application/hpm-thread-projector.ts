import type { HpmFreshness, HpmLifecycleThread, HpmLineageRelationship, HpmProjectedRecord, HpmProjectionScope, HpmSourceReference } from "./hpm-contracts";
import { evaluateHpmHealth } from "./hpm-health-policy";
import { deterministicHpmThreadKey } from "./hpm-lineage-projector";
import { HPM_LIFECYCLE_STAGES, type HpmLifecycleStage } from "./hpm-vocabulary";

const referenceKey = (value: HpmSourceReference) => `${value.capability}:${value.recordType}:${value.recordId}:${value.recordVersion}`;

export function projectHpmThreads(input: Readonly<{
  records: readonly HpmProjectedRecord[];
  lineage: readonly HpmLineageRelationship[];
  scope: HpmProjectionScope;
  sourceFreshness: ReadonlyMap<string, HpmFreshness>;
  asOf: string;
}>): readonly HpmLifecycleThread[] {
  const byReference = new Map(input.records.map((record) => [referenceKey(record.source), record]));
  const adjacency = new Map<string, Set<string>>();
  for (const record of input.records) adjacency.set(referenceKey(record.source), new Set());
  for (const edge of input.lineage) {
    adjacency.get(referenceKey(edge.source))?.add(referenceKey(edge.target));
    adjacency.get(referenceKey(edge.target))?.add(referenceKey(edge.source));
  }
  const canonicalGroups = new Map<string, HpmProjectedRecord[]>();
  for (const record of input.records.filter(({ canonicalThreadId }) => canonicalThreadId)) canonicalGroups.set(record.canonicalThreadId!, [...(canonicalGroups.get(record.canonicalThreadId!) ?? []), record]);
  for (const group of canonicalGroups.values()) for (const left of group) for (const right of group) if (left !== right) adjacency.get(referenceKey(left.source))?.add(referenceKey(right.source));

  const visited = new Set<string>();
  const threads: HpmLifecycleThread[] = [];
  for (const start of [...byReference.keys()].sort()) {
    if (visited.has(start)) continue;
    const queue = [start], component: HpmProjectedRecord[] = [];
    while (queue.length) {
      const key = queue.shift()!;
      if (visited.has(key)) continue;
      visited.add(key);
      const record = byReference.get(key);
      if (record) component.push(record);
      for (const related of [...(adjacency.get(key) ?? [])].sort()) if (!visited.has(related)) queue.push(related);
    }
    component.sort(recordOrder);
    const origin = component[0];
    const edges = input.lineage.filter((edge) => component.some((record) => referenceKey(record.source) === referenceKey(edge.source)) && component.some((record) => referenceKey(record.source) === referenceKey(edge.target)));
    const freshness = component.map((record) => input.sourceFreshness.get(record.source.capability) ?? "unavailable");
    const signals = component.flatMap((record) => record.healthSignals ?? []);
    const health = evaluateHpmHealth({ signals, freshness, evaluatedAt: input.asOf, applicable: true });
    const blockers = [...new Set(component.flatMap((record) => record.blocker ? [record.blocker] : []))].sort();
    const currentStage = deriveCurrentLifecyclePosition(component);
    const participating = new Set(component.map(({ stage }) => stage));
    const canonicalThreadId = component.map(({ canonicalThreadId: value }) => value).find((value): value is string => Boolean(value));
    threads.push(Object.freeze({
      threadKey: deterministicHpmThreadKey(input.scope, origin.source, canonicalThreadId),
      scope: input.scope,
      origin: origin.source,
      records: Object.freeze(component),
      relationships: Object.freeze(edges),
      currentStage,
      authoritativeOwner: authoritativeOwner(component, currentStage),
      health: health.state,
      healthReasons: health.reasonCodes,
      blockers: Object.freeze(blockers),
      missingStages: Object.freeze([...new Set(component.flatMap(({ expectedNextStage }) => expectedNextStage && !participating.has(expectedNextStage) ? [expectedNextStage] : []))]),
      timeline: Object.freeze(component.map((record) => ({ at: record.updatedAt, source: record.source, event: record.canonicalStatus })).sort((a, b) => a.at.localeCompare(b.at) || referenceKey(a.source).localeCompare(referenceKey(b.source)))),
      partial: freshness.some((value) => value !== "current" && value !== "not-applicable"),
      freshness: worstFreshness(freshness),
      firstObservedAt: component.map(({ createdAt }) => createdAt).sort()[0],
      lastChangedAt: component.map(({ updatedAt }) => updatedAt).sort().at(-1)!,
      asOf: input.asOf,
    }));
  }
  return Object.freeze(threads.sort((a, b) => b.lastChangedAt.localeCompare(a.lastChangedAt) || a.threadKey.localeCompare(b.threadKey)));
}

export function deriveCurrentLifecyclePosition(records: readonly HpmProjectedRecord[]): HpmLifecycleStage {
  const blocked = records.filter((record) => record.blocker || record.presentationState === "blocked").sort(recordOrder);
  if (blocked.length) return blocked[0].stage;
  if (records.some((record) => record.healthSignals?.some(({ code }) => code === "measurement-awaiting" || code === "measurement-overdue"))) return "learn";
  const active = records.filter((record) => !["completed", "evaluated", "superseded", "archived"].includes(record.presentationState));
  const candidates = active.length ? active : records;
  return [...candidates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || HPM_LIFECYCLE_STAGES.indexOf(b.stage) - HPM_LIFECYCLE_STAGES.indexOf(a.stage))[0]?.stage ?? "see";
}

function authoritativeOwner(records: readonly HpmProjectedRecord[], stage: HpmLifecycleStage) {
  const record = [...records].filter((value) => value.stage === stage).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return record ? Object.freeze({ capability: record.source.capability, ownerId: record.responsibleOwnerId, role: record.responsibleRole }) : undefined;
}
function recordOrder(a: HpmProjectedRecord, b: HpmProjectedRecord) { return HPM_LIFECYCLE_STAGES.indexOf(a.stage) - HPM_LIFECYCLE_STAGES.indexOf(b.stage) || a.createdAt.localeCompare(b.createdAt) || referenceKey(a.source).localeCompare(referenceKey(b.source)); }
function worstFreshness(values: readonly HpmFreshness[]): HpmFreshness { const order: HpmFreshness[] = ["unavailable", "incomplete", "stale", "delayed", "not-configured", "current", "not-applicable"]; return order.find((value) => values.includes(value)) ?? "unavailable"; }

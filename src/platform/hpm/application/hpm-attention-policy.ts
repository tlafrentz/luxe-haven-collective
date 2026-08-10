import { createHash } from "node:crypto";
import type { HpmAttentionItem, HpmAttentionReasonCode, HpmAttentionSignal, HpmFreshness, HpmLifecycleProjection, HpmProjectedRecord, HpmSourceReference } from "./hpm-contracts";
import { HPM_LIFECYCLE_STAGES } from "./hpm-vocabulary";

export const HPM_ATTENTION_POLICY_VERSION = "hpm-attention-v1";

const REASON_TIER: Readonly<Record<HpmAttentionReasonCode, number>> = Object.freeze({
  "active-source-invalidated": 1,
  "critical-guardrail-breach": 2,
  "material-risk-review": 2,
  "lifecycle-blocking-conflict": 3,
  "required-handoff-broken": 3,
  "authority-overdue": 4,
  "review-overdue": 4,
  "accepted-handoff-required": 5,
  "critical-execution-blocked": 6,
  "measurement-overdue": 7,
  "learning-reevaluation-required": 8,
  "context-required": 9,
  "deferred-review-due": 10,
  "expiration-approaching": 10,
  "material-source-stale": 11,
  "follow-up-required": 12,
});
const SEVERITY = { critical: 0, high: 1, medium: 2, low: 3 } as const;
const URGENCY = { breached: 0, due: 1, approaching: 2, none: 3 } as const;
const IMPACT = { "invalidates-active": 0, "blocks-lifecycle": 1, "delays-lifecycle": 2, "follow-up": 3 } as const;
const SCOPE = { portfolio: 0, "multi-property": 1, property: 2, record: 3 } as const;
const DEPENDENCY = { blocking: 0, material: 1, none: 2 } as const;

export type HpmAttentionCandidate = Readonly<{ record: HpmProjectedRecord; signal: HpmAttentionSignal; freshness: HpmFreshness; partial: boolean; currentLifecyclePosition: HpmAttentionItem["currentLifecyclePosition"] }>;

export function extractHpmAttentionCandidates(projection: HpmLifecycleProjection): readonly HpmAttentionCandidate[] {
  const freshness = new Map(projection.sourceStates.map((state) => [state.capability, state.freshness]));
  const threadPosition = new Map(projection.threads.flatMap((thread) => thread.records.map((record) => [referenceKey(record.source), thread.currentStage] as const)));
  const candidates = projection.threads.flatMap((thread) => thread.records.flatMap((record) => (record.attentionSignals ?? []).map((signal) => Object.freeze({ record, signal, freshness: freshness.get(record.source.capability) ?? "unavailable", partial: projection.partial || thread.partial, currentLifecyclePosition: threadPosition.get(referenceKey(record.source)) ?? record.stage }))));
  const deduplicated = new Map<string, HpmAttentionCandidate>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const existing = deduplicated.get(key);
    if (!existing || compareAttentionTuple(buildRankTuple(candidate, projection.asOf), buildRankTuple(existing, projection.asOf)) < 0) deduplicated.set(key, candidate);
  }
  return Object.freeze([...deduplicated.values()]);
}

export function projectHpmAttentionItems(projection: HpmLifecycleProjection): readonly HpmAttentionItem[] {
  const candidates = extractHpmAttentionCandidates(projection);
  return Object.freeze(candidates.map((candidate) => toItem(candidate, projection.asOf, projection.scope)).sort((a, b) => compareAttentionTuple(a.rankTuple!, b.rankTuple!)).map((item, index) => Object.freeze({ ...item, rank: index + 1 })));
}

export function buildRankTuple(candidate: HpmAttentionCandidate, asOf: string): readonly (number | string)[] {
  const { signal, record } = candidate;
  const ageMs = Math.max(0, Date.parse(asOf) - Date.parse(signal.ageBasisAt ?? record.updatedAt));
  const freshnessCaveat = candidate.freshness === "current" ? 0 : candidate.freshness === "delayed" ? 1 : 2;
  return Object.freeze([
    REASON_TIER[signal.reasonCode],
    IMPACT[signal.lifecycleImpact],
    SEVERITY[signal.severity],
    URGENCY[signal.urgency],
    signal.requiresHumanAuthority ? 0 : 1,
    SCOPE[signal.scopeImpact],
    DEPENDENCY[signal.dependencyImpact],
    -ageMs,
    freshnessCaveat,
    HPM_LIFECYCLE_STAGES.indexOf(record.stage),
    record.source.recordType,
    record.source.recordId,
    signal.reasonCode,
    stableItemKey(candidate, projectionScopeKey(record)),
  ]);
}

export function compareAttentionTuple(left: readonly (number | string)[], right: readonly (number | string)[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index], b = right[index];
    if (a === b) continue;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
  }
  return 0;
}

function toItem(candidate: HpmAttentionCandidate, asOf: string, scope: HpmLifecycleProjection["scope"]): HpmAttentionItem {
  const tuple = buildRankTuple(candidate, asOf), signal = candidate.signal, record = candidate.record;
  const commands = candidate.freshness === "stale" || candidate.freshness === "unavailable" || candidate.freshness === "not-configured" ? [] : record.validNextCommands.filter(({ availability }) => availability === "available");
  const caveats = [candidate.partial ? "projection-partial" : null, candidate.freshness !== "current" ? `source-${candidate.freshness}` : null].filter((value): value is string => Boolean(value));
  return Object.freeze({
    id: stableItemKey(candidate, scopeKey(scope)),
    itemKey: stableItemKey(candidate, scopeKey(scope)),
    rank: 0,
    rankBucket: REASON_TIER[signal.reasonCode],
    rankTuple: tuple,
    reason: signal.reasonCode,
    rankExplanation: `Ranked by ${signal.admittedByRule} under ${HPM_ATTENTION_POLICY_VERSION}.`,
    stage: record.stage,
    currentLifecyclePosition: candidate.currentLifecyclePosition,
    authoritativeRecord: record.source,
    scope,
    severity: signal.severity,
    urgency: signal.urgency,
    lifecycleImpact: signal.lifecycleImpact,
    classification: signal.classification,
    reasonCodes: [signal.reasonCode],
    ownerId: record.responsibleOwnerId,
    ownerRole: record.responsibleRole,
    dueAt: signal.dueAt,
    blocker: record.blocker,
    primaryNextCommand: commands[0],
    validNextCommands: Object.freeze(commands),
    explanation: Object.freeze({ admissionRule: signal.admittedByRule, policyVersion: HPM_ATTENTION_POLICY_VERSION, tuple, safeFactCodes: signal.safeFactCodes, caveats: Object.freeze(caveats), owningCapability: record.source.capability }),
    ageBasisAt: signal.ageBasisAt ?? record.updatedAt,
    ageMs: Math.max(0, Date.parse(asOf) - Date.parse(signal.ageBasisAt ?? record.updatedAt)),
    freshness: candidate.freshness,
    partial: candidate.partial,
    detailDestination: record.validNextCommands.find(({ destination }) => destination)?.destination,
    evaluatedAt: asOf,
  });
}

function candidateKey(candidate: HpmAttentionCandidate) { return `${referenceKey(candidate.record.source)}:${candidate.signal.reasonCode}:${candidate.signal.classification}`; }
function stableItemKey(candidate: HpmAttentionCandidate, scope: string) { return `hpm-attention:${createHash("sha256").update(`${HPM_ATTENTION_POLICY_VERSION}|${scope}|${candidateKey(candidate)}`).digest("hex").slice(0, 24)}`; }
function referenceKey(value: HpmSourceReference) { return `${value.capability}:${value.recordType}:${value.recordId}:${value.recordVersion}`; }
function scopeKey(scope: HpmLifecycleProjection["scope"]) { return `${scope.tenantId}:${scope.type}:${scope.portfolioId ?? ""}:${scope.propertyIds.join(",")}`; }
function projectionScopeKey(record: HpmProjectedRecord) { return `${record.tenantId}:${record.portfolioId ?? ""}:${record.propertyIds.join(",")}`; }

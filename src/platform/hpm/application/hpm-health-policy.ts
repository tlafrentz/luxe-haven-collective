import type { HpmFreshness, HpmHealthSignal, HpmLifecycleHealth, HpmSourceReference } from "./hpm-contracts";

export const HPM_HEALTH_POLICY_VERSION = "hpm-health-v1";

const HEALTH_PRECEDENCE: readonly HpmLifecycleHealth[] = [
  "blocked",
  "at-risk",
  "awaiting-authority",
  "awaiting-external-dependency",
  "awaiting-measurement",
  "incomplete-context",
  "stale",
  "attention-needed",
  "healthy",
  "not-applicable",
];

const SIGNAL_HEALTH: Readonly<Record<HpmHealthSignal["code"], HpmLifecycleHealth>> = Object.freeze({
  "critical-execution-blocked": "blocked",
  "outcome-guardrail-breached": "at-risk",
  "recommendation-learning-changed": "at-risk",
  "decision-review-overdue": "at-risk",
  "measurement-overdue": "at-risk",
  "authorization-awaiting": "awaiting-authority",
  "external-dependency-awaiting": "awaiting-external-dependency",
  "measurement-awaiting": "awaiting-measurement",
  "execution-linkage-missing": "incomplete-context",
  "lineage-broken": "incomplete-context",
  "context-missing": "incomplete-context",
  "high-severity-finding": "attention-needed",
  "completion-evidence-missing": "attention-needed",
  "lesson-reevaluation-required": "attention-needed",
});

export type HpmHealthResult = Readonly<{
  state: HpmLifecycleHealth;
  policyVersion: typeof HPM_HEALTH_POLICY_VERSION;
  reasonCodes: readonly string[];
  sourceReferences: readonly HpmSourceReference[];
  explanations: readonly string[];
  evaluatedAt: string;
}>;

export function evaluateHpmHealth(input: Readonly<{
  signals: readonly HpmHealthSignal[];
  freshness: readonly HpmFreshness[];
  evaluatedAt: string;
  applicable: boolean;
}>): HpmHealthResult {
  const candidates = input.signals.map((signal) => SIGNAL_HEALTH[signal.code]);
  if (input.freshness.some((value) => value === "unavailable" || value === "incomplete" || value === "not-configured")) candidates.push("incomplete-context");
  else if (input.freshness.some((value) => value === "stale" || value === "delayed")) candidates.push("stale");
  if (!candidates.length) candidates.push(input.applicable ? "healthy" : "not-applicable");
  const state = HEALTH_PRECEDENCE.find((candidate) => candidates.includes(candidate)) ?? "healthy";
  const orderedSignals = [...input.signals].sort((a, b) => a.code.localeCompare(b.code) || referenceKey(a.source).localeCompare(referenceKey(b.source)));
  return Object.freeze({
    state,
    policyVersion: HPM_HEALTH_POLICY_VERSION,
    reasonCodes: Object.freeze([...new Set(orderedSignals.map(({ code }) => code))]),
    sourceReferences: Object.freeze(orderedSignals.map(({ source }) => source)),
    explanations: Object.freeze(orderedSignals.map(({ explanation }) => explanation)),
    evaluatedAt: input.evaluatedAt,
  });
}

function referenceKey(value: HpmSourceReference) {
  return `${value.capability}:${value.recordType}:${value.recordId}:${value.recordVersion}`;
}

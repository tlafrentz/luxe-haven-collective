import type { HpmFreshness, HpmSourceState } from "./hpm-contracts";
import type { HpmSourceCapability } from "./hpm-vocabulary";

export const HPM_FRESHNESS_POLICY_VERSION = "hpm-freshness-v1";

export type HpmFreshnessThreshold = Readonly<{ delayedAfterMs: number; staleAfterMs: number }>;
export type HpmFreshnessPolicy = Readonly<Record<HpmSourceCapability, HpmFreshnessThreshold>>;

export const DEFAULT_HPM_FRESHNESS_POLICY: HpmFreshnessPolicy = Object.freeze({
  observations: { delayedAfterMs: 60 * 60_000, staleAfterMs: 24 * 60 * 60_000 },
  intelligence: { delayedAfterMs: 24 * 60 * 60_000, staleAfterMs: 7 * 24 * 60 * 60_000 },
  decisions: { delayedAfterMs: 7 * 24 * 60 * 60_000, staleAfterMs: 30 * 24 * 60 * 60_000 },
  execute: { delayedAfterMs: 24 * 60 * 60_000, staleAfterMs: 7 * 24 * 60 * 60_000 },
  outcomes: { delayedAfterMs: 7 * 24 * 60 * 60_000, staleAfterMs: 30 * 24 * 60 * 60_000 },
  learning: { delayedAfterMs: 14 * 24 * 60 * 60_000, staleAfterMs: 60 * 24 * 60 * 60_000 },
  recommendations: { delayedAfterMs: 7 * 24 * 60 * 60_000, staleAfterMs: 30 * 24 * 60 * 60_000 },
});

export function evaluateHpmFreshness(state: HpmSourceState, evaluatedAt: string, policy: HpmFreshnessPolicy = DEFAULT_HPM_FRESHNESS_POLICY): HpmSourceState {
  if (state.freshness !== "current" || !state.observedAt) return Object.freeze({ ...state, contributesToCounts: state.freshness !== "unavailable" && state.freshness !== "not-configured", contributesToHealth: state.freshness !== "not-applicable", contributesToLineage: state.freshness !== "unavailable" && state.freshness !== "not-configured", reasonCode: state.reasonCode ?? `source-${state.freshness}` });
  const age = Math.max(0, Date.parse(evaluatedAt) - Date.parse(state.observedAt));
  const threshold = policy[state.capability];
  const freshness: HpmFreshness = age >= threshold.staleAfterMs ? "stale" : age >= threshold.delayedAfterMs ? "delayed" : "current";
  return Object.freeze({ ...state, freshness, contributesToCounts: true, contributesToHealth: true, contributesToLineage: freshness !== "stale", reasonCode: `source-${freshness}` });
}

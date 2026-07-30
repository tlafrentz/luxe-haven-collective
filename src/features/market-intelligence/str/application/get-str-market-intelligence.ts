import type { StrMarketIntelligenceProvider, StrMarketQuery, StrMarketSnapshot, StrMarketSnapshotRepository } from "../domain";
import { freezeStrSnapshot, STR_COMPARABLE_POLICY_VERSION, STR_MARKET_SNAPSHOT_SCHEMA_VERSION } from "../domain";
import { assessStrMarketConfidence, qualifyAndWeightComparables } from "./str-market-policy";

const inflight = new Map<string, Promise<StrMarketSnapshot>>();
export interface GetStrMarketIntelligenceInput {
  readonly ownerId: string; readonly workspaceId: string; readonly query: StrMarketQuery;
  readonly correlationId?: string; readonly refresh?: boolean;
}
export interface StrWorkflowTelemetry { emit(event: string, attributes: Readonly<Record<string, string | number | boolean | undefined>>): void }
const noop: StrWorkflowTelemetry = { emit() {} };

export function createStrMarketIntelligenceService(dependencies: {
  readonly provider: StrMarketIntelligenceProvider; readonly repository: StrMarketSnapshotRepository;
  readonly providerVersion: string; readonly snapshotTtlDays?: number; readonly now?: () => Date; readonly telemetry?: StrWorkflowTelemetry;
}) {
  const now = dependencies.now ?? (() => new Date()); const telemetry = dependencies.telemetry ?? noop;
  return async (input: GetStrMarketIntelligenceInput): Promise<StrMarketSnapshot> => {
    const key = fingerprint(input); const current = now();
    if (!input.refresh) {
      const cached = await dependencies.repository.findCompatible({
        ownerId: input.ownerId, workspaceId: input.workspaceId, query: input.query,
        comparablePolicyVersion: STR_COMPARABLE_POLICY_VERSION, providerVersion: dependencies.providerVersion, now: current,
      });
      if (cached) { telemetry.emit("str_market_snapshot_cache_hit", { correlationId: input.correlationId, subjectPropertyId: input.query.subjectPropertyId, snapshotId: cached.id }); return cached; }
      telemetry.emit("str_market_snapshot_cache_miss", { correlationId: input.correlationId, subjectPropertyId: input.query.subjectPropertyId });
      const existing = inflight.get(key); if (existing) return existing;
    } else telemetry.emit("str_market_snapshot_refresh_started", { correlationId: input.correlationId, subjectPropertyId: input.query.subjectPropertyId });
    const operation = build(input, current, dependencies, telemetry);
    inflight.set(key, operation);
    try { return await operation; } finally { if (inflight.get(key) === operation) inflight.delete(key); }
  };
}

async function build(input: GetStrMarketIntelligenceInput, created: Date, dependencies: {
  provider: StrMarketIntelligenceProvider; repository: StrMarketSnapshotRepository; providerVersion: string;
  snapshotTtlDays?: number;
}, telemetry: StrWorkflowTelemetry): Promise<StrMarketSnapshot> {
  const id = crypto.randomUUID(); const correlationId = input.correlationId ?? crypto.randomUUID();
  const result = await dependencies.provider.retrieve(input.query, { snapshotId: id, correlationId });
  const comparables = qualifyAndWeightComparables(result.comparables, input.query);
  const radiusFilter = result.appliedFilters.find((filter) => filter.startsWith("radiusMiles:"));
  const radius = radiusFilter ? Number(radiusFilter.split(":")[1]) : input.query.filters?.radiusMiles;
  const relaxedRules = radius && input.query.filters?.radiusMiles && radius > input.query.filters.radiusMiles ? [`radius expanded to ${radius} miles`] : [];
  const confidence = assessStrMarketConfidence({ query: input.query, comparables, hasRevenueEstimate: Boolean(result.revenueEstimate),
    hasMarketMetrics: Boolean(result.marketMetrics), hasSeasonality: Boolean(result.seasonality), relaxedRules });
  const eligibleCount = comparables.filter((item) => item.eligibility === "eligible").length;
  const warnings = [...result.warnings, ...confidence.limitations];
  const snapshot = freezeStrSnapshot<StrMarketSnapshot>({
    id, ownerId: input.ownerId, workspaceId: input.workspaceId, subjectPropertyId: input.query.subjectPropertyId,
    subjectPropertySnapshotId: input.query.subjectPropertySnapshotId, provider: "airroi",
    providerSnapshotReferences: result.providerSnapshotReferences, schemaVersion: STR_MARKET_SNAPSHOT_SCHEMA_VERSION,
    providerVersion: result.providerVersion, queryPolicyVersion: "str-query.v1", comparablePolicyVersion: STR_COMPARABLE_POLICY_VERSION,
    createdAt: created.toISOString(), expiresAt: new Date(created.getTime() + (dependencies.snapshotTtlDays ?? 30) * 86_400_000).toISOString(),
    query: input.query, revenueEstimate: result.revenueEstimate, marketMetrics: result.marketMetrics, seasonality: result.seasonality,
    comparables, confidence, completeness: result.revenueEstimate && eligibleCount >= 5 ? "complete" : result.revenueEstimate || result.marketMetrics ? "partial" : "insufficient",
    evidence: result.evidence, evidenceIds: result.evidence.map((item) => item.id), warnings: [...new Set(warnings)], relaxedRules,
  });
  await dependencies.repository.save(snapshot);
  telemetry.emit("str_comparables_received", { correlationId, snapshotId: id, comparableCount: result.comparables.length });
  telemetry.emit("str_comparables_qualified", { correlationId, snapshotId: id, comparableCount: eligibleCount });
  telemetry.emit("str_comparables_rejected", { correlationId, snapshotId: id, comparableCount: comparables.length - eligibleCount });
  telemetry.emit("str_market_snapshot_created", { correlationId, snapshotId: id, subjectPropertyId: input.query.subjectPropertyId });
  if (input.refresh) telemetry.emit("str_market_snapshot_refresh_completed", { correlationId, snapshotId: id });
  return snapshot;
}

function fingerprint(input: GetStrMarketIntelligenceInput): string {
  return stableHash(JSON.stringify({
    ownerId: input.ownerId, workspaceId: input.workspaceId, subjectPropertySnapshotId: input.query.subjectPropertySnapshotId,
    property: input.query.property, filters: input.query.filters, policy: STR_COMPARABLE_POLICY_VERSION,
  }));
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

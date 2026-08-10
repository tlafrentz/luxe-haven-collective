import { createHash } from "node:crypto";
import type { HpmFailureCode, HpmHealthSignal, HpmLifecycleProjection, HpmProjectedRecord, HpmProjectionScope, HpmSourceState, HpmStageSummary } from "./hpm-contracts";
import { evaluateHpmFreshness, HPM_FRESHNESS_POLICY_VERSION, type HpmFreshnessPolicy, DEFAULT_HPM_FRESHNESS_POLICY } from "./hpm-freshness-policy";
import { evaluateHpmHealth, HPM_HEALTH_POLICY_VERSION } from "./hpm-health-policy";
import { assembleHpmLineage, HPM_LINEAGE_POLICY_VERSION } from "./hpm-lineage-projector";
import type { HpmActorContext, HpmSourcePortRegistry } from "./hpm-source-ports";
import { projectHpmThreads } from "./hpm-thread-projector";
import { HPM_CAPABILITY_STAGE, HPM_LIFECYCLE_STAGES, HPM_PROJECTION_POLICY_VERSION, HPM_SOURCE_CAPABILITIES, type HpmSourceCapability } from "./hpm-vocabulary";

export const HPM_LIFECYCLE_POLICY_VERSION = "hpm-lifecycle-v1";
export const HPM_STAGE_VOCABULARY_VERSION = "hpm-stage-v1";

export type HpmProjectionRequest = Readonly<{
  actor: HpmActorContext;
  scopeType: "property" | "portfolio";
  scopeId: string;
  asOf: string;
  correlationId: string;
  policyVersions: Readonly<{ lifecycle: string; health: string; lineage: string; freshness: string }>;
  includeCapabilities?: readonly HpmSourceCapability[];
}>;

export type HpmProjectionResult =
  | Readonly<{ ok: true; projection: HpmLifecycleProjection }>
  | Readonly<{ ok: false; code: "HPM_SCOPE_NOT_FOUND" | "HPM_SCOPE_ACCESS_DENIED" | "HPM_PROJECTION_POLICY_MISMATCH" | "HPM_PROJECTION_UNAVAILABLE"; message: string }>;

type HpmProjectionFailureCode = Extract<HpmProjectionResult, { ok: false }>["code"];

export interface HpmScopeAuthorizer {
  resolve(input: Readonly<{ actor: HpmActorContext; scopeType: "property" | "portfolio"; scopeId: string; asOf: string }>): Promise<Readonly<{ ok: true; scope: HpmProjectionScope } | { ok: false; code: "HPM_SCOPE_NOT_FOUND" | "HPM_SCOPE_ACCESS_DENIED" }>>;
}

export interface HpmTelemetry {
  emit(event: Readonly<{ name: string; correlationId: string; scopeType: string; capability?: HpmSourceCapability; classification?: string; count?: number }>): void;
}

export type HpmLifecycleProjectionDependencies = Readonly<{
  sources: HpmSourcePortRegistry;
  scopeAuthorizer: HpmScopeAuthorizer;
  telemetry?: HpmTelemetry;
  freshnessPolicy?: HpmFreshnessPolicy;
  supportedSourceVersions?: Partial<Readonly<Record<HpmSourceCapability, readonly string[]>>>;
  now?: () => string;
}>;

export function createHpmLifecycleProjectionService(dependencies: HpmLifecycleProjectionDependencies) {
  return Object.freeze({
    async buildHpmLifecycleProjection(request: HpmProjectionRequest): Promise<HpmProjectionResult> {
      dependencies.telemetry?.emit({ name: "hpm_lifecycle_projection_started", correlationId: request.correlationId, scopeType: request.scopeType });
      if (!policyVersionsMatch(request.policyVersions)) return failure("HPM_PROJECTION_POLICY_MISMATCH", "The requested HPM policy versions are unsupported.", dependencies, request);
      let resolved: Awaited<ReturnType<HpmScopeAuthorizer["resolve"]>>;
      try {
        resolved = await dependencies.scopeAuthorizer.resolve({ actor: request.actor, scopeType: request.scopeType, scopeId: request.scopeId, asOf: request.asOf });
      } catch {
        return failure("HPM_PROJECTION_UNAVAILABLE", "The HPM scope could not be resolved.", dependencies, request);
      }
      if (!resolved.ok) return failure(resolved.code, "The requested HPM scope is unavailable.", dependencies, request);
      const included = new Set(request.includeCapabilities ?? HPM_SOURCE_CAPABILITIES);
      const results = await Promise.all(HPM_SOURCE_CAPABILITIES.map(async (capability) => {
        if (!included.has(capability)) return omittedState(capability);
        const source = dependencies.sources[capability];
        const supported = dependencies.supportedSourceVersions?.[capability] ?? ["v1", "unavailable-v1"];
        if (!supported.includes(source.contractVersion)) {
          dependencies.telemetry?.emit({ name: "hpm_source_projection_failed", correlationId: request.correlationId, scopeType: request.scopeType, capability, classification: "HPM_SOURCE_VERSION_CONFLICT" });
          return { state: incompatibleState(capability, source.contractVersion), records: [] as readonly HpmProjectedRecord[] };
        }
        try {
          const value = await source.project({ scope: resolved.scope, actor: request.actor, correlationId: request.correlationId, requestedAt: request.asOf });
          dependencies.telemetry?.emit({ name: "hpm_source_projection_completed", correlationId: request.correlationId, scopeType: request.scopeType, capability, classification: value.state.freshness, count: value.records.length });
          return { ...value, state: { ...value.state, contractVersion: source.contractVersion } };
        } catch {
          dependencies.telemetry?.emit({ name: "hpm_source_projection_failed", correlationId: request.correlationId, scopeType: request.scopeType, capability, classification: "HPM_SOURCE_UNAVAILABLE" });
          return { state: unavailableState(capability), records: [] as readonly HpmProjectedRecord[] };
        }
      }));
      const freshnessPolicy = dependencies.freshnessPolicy ?? DEFAULT_HPM_FRESHNESS_POLICY;
      const sourceStates = results.map(({ state }) => evaluateHpmFreshness(state, request.asOf, freshnessPolicy));
      const records = results.flatMap(({ records }, index) => filterAuthorizedRecords(records, resolved.scope, sourceStates[index]));
      const availableSourceCount = sourceStates.filter(({ freshness }) => !["unavailable", "not-configured"].includes(freshness)).length;
      if (!availableSourceCount) return failure("HPM_PROJECTION_UNAVAILABLE", "No authorized lifecycle sources are currently available.", dependencies, request);
      const lineageResult = assembleHpmLineage(records, resolved.scope);
      const sourceFreshness = new Map(sourceStates.map((state) => [state.capability, state.freshness]));
      const threads = projectHpmThreads({ records, lineage: lineageResult.edges, scope: resolved.scope, sourceFreshness, asOf: request.asOf });
      const stages = projectStageSummaries(records, sourceStates, request.asOf);
      const healthSignals: HpmHealthSignal[] = records.flatMap((record) => record.healthSignals ?? []);
      for (const gap of lineageResult.gaps) healthSignals.push({ code: "lineage-broken", source: gap.source, explanation: "A visible lifecycle relationship could not be safely resolved." });
      const health = evaluateHpmHealth({ signals: healthSignals, freshness: sourceStates.map(({ freshness }) => freshness), evaluatedAt: request.asOf, applicable: true });
      const completeness = sourceStates.every(({ freshness }) => freshness === "current" || freshness === "not-applicable") ? "complete" : "partial";
      const failures = sourceStates.flatMap((state) => state.failureClassification ? [{ capability: state.capability, classification: safeFailure(state.failureClassification), message: "A lifecycle source is unavailable." }] : []);
      const projectedAt = dependencies.now?.() ?? request.asOf;
      const projection: HpmLifecycleProjection = Object.freeze({
        projectionId: projectionId(resolved.scope, request, sourceStates, records),
        projectionPolicyVersion: HPM_PROJECTION_POLICY_VERSION,
        policyVersions: request.policyVersions,
        scope: resolved.scope,
        projectedAt,
        asOf: request.asOf,
        health: health.state,
        healthReasons: health.reasonCodes,
        stages,
        attention: [],
        threads,
        recentlyChanged: Object.freeze([...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || sourceKey(a).localeCompare(sourceKey(b))).slice(0, 20)),
        lineage: lineageResult.edges,
        sourceStates: Object.freeze(sourceStates),
        partial: completeness === "partial",
        completeness,
        coverage: Object.freeze({ applicableSources: sourceStates.filter(({ freshness }) => freshness !== "not-applicable").length, availableSources: availableSourceCount, limitations: Object.freeze(sourceStates.filter(({ freshness }) => freshness !== "current" && freshness !== "not-applicable").map(({ capability, reasonCode }) => `${capability}:${reasonCode ?? "source-limited"}`)) }),
        failures: Object.freeze(failures),
        validNextCommands: [],
        reports: [],
      });
      for (const state of sourceStates) dependencies.telemetry?.emit({ name: "hpm_freshness_evaluated", correlationId: request.correlationId, scopeType: request.scopeType, capability: state.capability, classification: state.freshness });
      for (const thread of threads) dependencies.telemetry?.emit({ name: "hpm_lifecycle_thread_constructed", correlationId: request.correlationId, scopeType: request.scopeType, classification: thread.health, count: thread.records.length });
      for (const gap of lineageResult.gaps) dependencies.telemetry?.emit({ name: "hpm_lineage_gap_detected", correlationId: request.correlationId, scopeType: request.scopeType, capability: gap.source.capability, classification: gap.code });
      dependencies.telemetry?.emit({ name: "hpm_health_evaluated", correlationId: request.correlationId, scopeType: request.scopeType, classification: health.state, count: health.reasonCodes.length });
      dependencies.telemetry?.emit({ name: completeness === "partial" ? "hpm_lifecycle_projection_partial" : "hpm_lifecycle_projection_completed", correlationId: request.correlationId, scopeType: request.scopeType, classification: completeness, count: records.length });
      return Object.freeze({ ok: true, projection });
    },
  });
}

function projectStageSummaries(records: readonly HpmProjectedRecord[], sourceStates: readonly HpmSourceState[], asOf: string): readonly HpmStageSummary[] {
  return Object.freeze(HPM_LIFECYCLE_STAGES.map((stage) => {
    const stageRecords = records.filter((record) => record.stage === stage);
    const states = sourceStates.filter((state) => HPM_CAPABILITY_STAGE[state.capability] === stage);
    const freshness = worstFreshness(states.map(({ freshness }) => freshness));
    const applicable = states.some(({ freshness: value }) => value !== "not-applicable");
    const availability = !applicable ? "not-applicable" : states.every(({ freshness: value }) => value === "not-configured") ? "not-configured" : states.every(({ freshness: value }) => value === "unavailable") ? "unavailable" : states.some(({ freshness: value }) => value !== "current") ? "partial" : "available";
    const health = evaluateHpmHealth({ signals: stageRecords.flatMap((record) => record.healthSignals ?? []), freshness: states.map(({ freshness: value }) => value), evaluatedAt: asOf, applicable });
    const unresolved = stageRecords.filter(({ presentationState }) => !["completed", "evaluated", "superseded", "archived"].includes(presentationState));
    return Object.freeze({
      stage,
      vocabularyVersion: HPM_STAGE_VOCABULARY_VERSION,
      availability,
      visibleCount: stageRecords.length,
      activeCount: stageRecords.filter(({ presentationState }) => ["ready-to-proceed", "in-progress", "awaiting-evidence", "awaiting-measurement"].includes(presentationState)).length,
      completedCount: stageRecords.filter(({ presentationState }) => ["completed", "evaluated"].includes(presentationState)).length,
      blockedCount: stageRecords.filter(({ presentationState, blocker }) => presentationState === "blocked" || Boolean(blocker)).length,
      requiringReviewCount: stageRecords.filter(({ presentationState }) => presentationState === "awaiting-review" || presentationState === "needs-reevaluation").length,
      attentionCount: stageRecords.filter(({ attentionState }) => attentionState !== "none").length,
      health: health.state,
      healthReasonCodes: health.reasonCodes,
      freshness,
      asOf,
      lastSuccessfulAsOf: states.map(({ lastSuccessfulAsOf }) => lastSuccessfulAsOf).filter((value): value is string => Boolean(value)).sort().at(-1),
      oldestUnresolvedAt: unresolved.map(({ createdAt }) => createdAt).sort()[0],
      sourceVersions: Object.freeze(states.map((state) => ({ capability: state.capability, contractVersion: state.contractVersion, sourceVersion: state.sourceVersion, policyVersion: state.policyVersion }))),
      dataGaps: Object.freeze(states.filter(({ freshness: value }) => ["incomplete", "unavailable", "not-configured"].includes(value)).map(({ capability, reasonCode }) => `${capability}:${reasonCode ?? "source-limited"}`)),
      limitations: Object.freeze(states.filter(({ freshness: value }) => value === "stale" || value === "delayed").map(({ capability, freshness: value }) => `${capability} data is ${value}.`)),
    });
  }));
}

function filterAuthorizedRecords(records: readonly HpmProjectedRecord[], scope: HpmProjectionScope, state: HpmSourceState) {
  if (state.contributesToCounts === false) return [];
  const allowed = new Set(scope.propertyIds);
  return records.filter((record) => record.tenantId === scope.tenantId && record.visibility !== "restricted" && (scope.type === "property" ? record.propertyIds.includes(scope.propertyIds[0]) : record.propertyIds.every((id) => allowed.has(id))));
}
function policyVersionsMatch(value: HpmProjectionRequest["policyVersions"]) { return value.lifecycle === HPM_LIFECYCLE_POLICY_VERSION && value.health === HPM_HEALTH_POLICY_VERSION && value.lineage === HPM_LINEAGE_POLICY_VERSION && value.freshness === HPM_FRESHNESS_POLICY_VERSION; }
function failure(code: HpmProjectionFailureCode, message: string, deps: HpmLifecycleProjectionDependencies, request: HpmProjectionRequest): HpmProjectionResult { deps.telemetry?.emit({ name: "hpm_lifecycle_projection_failed", correlationId: request.correlationId, scopeType: request.scopeType, classification: code }); return Object.freeze({ ok: false, code, message }); }
function safeFailure(value: string): HpmFailureCode { return value === "HPM_SOURCE_VERSION_CONFLICT" ? value : value === "HPM_SOURCE_STALE" ? value : "HPM_SOURCE_UNAVAILABLE"; }
function unavailableState(capability: HpmSourceCapability): HpmSourceState { return Object.freeze({ capability, freshness: "unavailable", policyVersion: "unavailable-v1", failureClassification: "HPM_SOURCE_UNAVAILABLE", contributesToCounts: false, contributesToHealth: true, contributesToLineage: false, reasonCode: "source-unavailable" }); }
function incompatibleState(capability: HpmSourceCapability, contractVersion: string): HpmSourceState { return Object.freeze({ capability, contractVersion, freshness: "unavailable", policyVersion: "incompatible-v1", failureClassification: "HPM_SOURCE_VERSION_CONFLICT", contributesToCounts: false, contributesToHealth: true, contributesToLineage: false, reasonCode: "source-contract-unsupported" }); }
function omittedState(capability: HpmSourceCapability) { return { state: Object.freeze({ capability, freshness: "not-applicable" as const, policyVersion: "internal-filter-v1", contributesToCounts: false, contributesToHealth: false, contributesToLineage: false, reasonCode: "source-filtered" }), records: [] as readonly HpmProjectedRecord[] }; }
function projectionId(scope: HpmProjectionScope, request: HpmProjectionRequest, states: readonly HpmSourceState[], records: readonly HpmProjectedRecord[]) { const value = JSON.stringify({ scope, asOf: request.asOf, policies: request.policyVersions, sources: states.map(({ capability, sourceVersion, policyVersion, freshness }) => ({ capability, sourceVersion, policyVersion, freshness })), records: records.map(({ source }) => `${source.capability}:${source.recordType}:${source.recordId}:${source.recordVersion}`).sort() }); return `hpm:${createHash("sha256").update(value).digest("hex").slice(0, 24)}`; }
function sourceKey(record: HpmProjectedRecord) { return `${record.source.capability}:${record.source.recordType}:${record.source.recordId}:${record.source.recordVersion}`; }
function worstFreshness(values: readonly HpmSourceState["freshness"][]): HpmSourceState["freshness"] { const order: HpmSourceState["freshness"][] = ["unavailable", "incomplete", "stale", "delayed", "not-configured", "current", "not-applicable"]; return order.find((value) => values.includes(value)) ?? "not-applicable"; }

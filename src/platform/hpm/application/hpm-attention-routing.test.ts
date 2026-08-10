import { describe, expect, it, vi } from "vitest";
import {
  HPM_ATTENTION_POLICY_VERSION,
  HPM_COMMAND_VOCABULARY_VERSION,
  HPM_PROJECTION_POLICY_VERSION,
  createHpmAttentionProjectionService,
  createHpmCommandRouteRegistry,
  createHpmCommandRoutingService,
  projectHpmAttentionItems,
  projectHpmValidCommands,
  type HpmActorContext,
  type HpmAttentionReasonCode,
  type HpmAttentionSignal,
  type HpmCanonicalCommandResult,
  type HpmCommandRoute,
  type HpmCommandRoutingRequest,
  type HpmLifecycleProjection,
  type HpmLifecycleStage,
  type HpmProjectedRecord,
  type HpmProjectionScope,
  type HpmSourceCapability,
} from ".";

const asOf = "2026-08-10T12:00:00.000Z";
const scope: HpmProjectionScope = { tenantId: "tenant-1", type: "property", propertyIds: ["property-1"], timeZone: "America/Chicago", from: "2026-08-01", to: "2026-08-10" };
const actor: HpmActorContext = { actorId: "actor-1", tenantId: "tenant-1", roleIds: ["operator"], propertyIds: ["property-1"], active: true };

const stageCapability: Record<HpmLifecycleStage, HpmSourceCapability> = { see: "observations", understand: "intelligence", decide: "decisions", execute: "execute", learn: "outcomes", recommend: "recommendations" };
const stageReason: Record<HpmLifecycleStage, HpmAttentionReasonCode> = { see: "material-source-stale", understand: "material-risk-review", decide: "authority-overdue", execute: "critical-execution-blocked", learn: "measurement-overdue", recommend: "accepted-handoff-required" };

function signal(stage: HpmLifecycleStage, overrides: Partial<HpmAttentionSignal> = {}): HpmAttentionSignal {
  const reasonCode = stageReason[stage];
  return { reasonCode, classification: reasonCode === "critical-execution-blocked" ? "blocked" : reasonCode === "measurement-overdue" ? "measurement-required" : reasonCode === "authority-overdue" ? "awaiting-authority" : reasonCode === "accepted-handoff-required" ? "handoff-required" : reasonCode === "material-source-stale" ? "stale-source" : "required-review", severity: stage === "execute" ? "critical" : "high", urgency: reasonCode.includes("overdue") ? "breached" : "due", lifecycleImpact: stage === "execute" ? "blocks-lifecycle" : "delays-lifecycle", scopeImpact: "property", requiresHumanAuthority: true, dependencyImpact: stage === "execute" ? "blocking" : "none", admittedByRule: `hpm-${stage}-rule`, safeFactCodes: [`${stage}-fact`], ageBasisAt: "2026-08-09T12:00:00.000Z", ...overrides };
}

function record(stage: HpmLifecycleStage, id: string = stage, attentionSignals: readonly HpmAttentionSignal[] = [signal(stage)]): HpmProjectedRecord {
  const capability = stageCapability[stage];
  const target = { capability, recordType: `${stage}-record`, recordId: id, recordVersion: "3" } as const;
  return { tenantId: "tenant-1", source: target, stage, canonicalStatus: "canonical-active", presentationState: "in-progress", summary: `${stage} summary`, propertyIds: ["property-1"], attentionState: "attention", responsibleOwnerId: "actor-1", attentionSignals, validNextCommands: [{ type: `review-${stage}`, vocabularyVersion: HPM_COMMAND_VOCABULARY_VERSION, intentKey: `review.${stage}`, owningCapability: capability, target, expectedVersion: "3", requiredAuthority: `review:${stage}`, availability: "available", correlationId: "correlation-1", idempotencyRequired: true, dispatchKey: `route:${capability}:review-${stage}`, resultBehavior: "refresh-projection" }], createdAt: "2026-08-09T10:00:00.000Z", updatedAt: "2026-08-09T11:00:00.000Z", visibility: "property", canonicalThreadId: `thread-${stage}` };
}

function projection(records = (["see", "understand", "decide", "execute", "learn", "recommend"] as const).map((stage) => record(stage))): HpmLifecycleProjection {
  return { projectionId: "projection-1", projectionPolicyVersion: HPM_PROJECTION_POLICY_VERSION, scope, projectedAt: asOf, asOf, health: "attention-needed", healthReasons: [], stages: [], attention: [], threads: records.map((value) => ({ threadKey: `thread:${value.source.recordId}`, scope, origin: value.source, records: [value], relationships: [], currentStage: value.stage, health: "attention-needed", healthReasons: [], blockers: [], missingStages: [], timeline: [], partial: false, freshness: "current", firstObservedAt: value.createdAt, lastChangedAt: value.updatedAt, asOf })), recentlyChanged: records, lineage: [], sourceStates: Object.values(stageCapability).map((capability) => ({ capability, freshness: "current", policyVersion: "v1" })), partial: false, completeness: "complete", validNextCommands: [], reports: [] };
}

function route(capability: HpmSourceCapability = "execute", commandType = "review-execute", result: HpmCanonicalCommandResult = { ok: true, recordId: "execute", recordVersion: "4", classification: "ACTION_STARTED" }): HpmCommandRoute {
  return { capability, commandType, vocabularyVersion: HPM_COMMAND_VOCABULARY_VERSION, async authorize() { return { allowed: true }; }, async dispatch() { return result; } };
}

function routingRequest(overrides: Partial<HpmCommandRoutingRequest> = {}): HpmCommandRoutingRequest {
  const target = { capability: "execute" as const, recordType: "execute-record", recordId: "execute", recordVersion: "3" };
  return { actor, commandType: "review-execute", commandVocabularyVersion: HPM_COMMAND_VOCABULARY_VERSION, owningCapability: "execute", target, expectedVersion: "3", input: {}, idempotencyKey: "intent-1", correlationId: "correlation-1", causationId: "attention-1", scopeType: "property", scopeId: "property-1", ...overrides };
}

describe("HPM-001C attention policy", () => {
  it("extracts one explicit candidate from every lifecycle stage", () => {
    const items = projectHpmAttentionItems(projection());
    expect(items).toHaveLength(6);
    expect(new Set(items.map(({ stage }) => stage))).toEqual(new Set(["see", "understand", "decide", "execute", "learn", "recommend"]));
    expect(items.every(({ explanation }) => explanation?.policyVersion === HPM_ATTENTION_POLICY_VERSION)).toBe(true);
  });

  it("uses exact top-level precedence and stable canonical tie breakers", () => {
    const invalidated = record("recommend", "z", [signal("recommend", { reasonCode: "active-source-invalidated", classification: "reevaluation-required" })]);
    const guardrail = record("learn", "a", [signal("learn", { reasonCode: "critical-guardrail-breach", classification: "critical-risk", severity: "critical" })]);
    const followupB = record("see", "b", [signal("see", { reasonCode: "follow-up-required", classification: "follow-up-required", severity: "low" })]);
    const followupA = record("see", "a", [signal("see", { reasonCode: "follow-up-required", classification: "follow-up-required", severity: "low" })]);
    expect(projectHpmAttentionItems(projection([followupB, guardrail, invalidated, followupA])).map(({ authoritativeRecord }) => authoritativeRecord.recordId)).toEqual(["z", "a", "a", "b"]);
  });

  it("deduplicates equivalent conditions while retaining distinct user decisions", () => {
    const duplicate = signal("execute");
    const value = record("execute", "a", [duplicate, duplicate, signal("execute", { reasonCode: "context-required", classification: "required-context" })]);
    expect(projectHpmAttentionItems(projection([value])).map(({ reason }) => reason)).toEqual(["critical-execution-blocked", "context-required"]);
  });

  it("paginates after global ranking and preserves filter-relative order", async () => {
    const routes = createHpmCommandRouteRegistry((Object.entries(stageCapability) as [HpmLifecycleStage, HpmSourceCapability][]).map(([stage, capability]) => route(capability, `review-${stage}`)));
    const service = createHpmAttentionProjectionService({ routes, now: () => asOf });
    const first = await service.buildHpmAttentionProjection({ actor, lifecycleProjection: projection(), attentionPolicyVersion: HPM_ATTENTION_POLICY_VERSION, commandVocabularyVersion: HPM_COMMAND_VOCABULARY_VERSION, correlationId: "c", limit: 2 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.projection.items).toHaveLength(2);
    expect(first.projection.pagination.hasMore).toBe(true);
    const second = await service.buildHpmAttentionProjection({ actor, lifecycleProjection: projection(), attentionPolicyVersion: HPM_ATTENTION_POLICY_VERSION, commandVocabularyVersion: HPM_COMMAND_VOCABULARY_VERSION, correlationId: "c", limit: 2, cursor: first.projection.pagination.nextCursor });
    expect(second.ok && second.projection.items[0].rank).toBe(3);
  });

  it("denies cross-property projection reuse before candidate construction", async () => {
    const service = createHpmAttentionProjectionService();
    const result = await service.buildHpmAttentionProjection({ actor: { ...actor, propertyIds: ["property-2"] }, lifecycleProjection: projection(), attentionPolicyVersion: HPM_ATTENTION_POLICY_VERSION, commandVocabularyVersion: HPM_COMMAND_VOCABULARY_VERSION, correlationId: "c" });
    expect(result).toMatchObject({ ok: false, code: "HPM_COMMAND_INPUT_INVALID" });
  });

  it("omits non-candidates and suppresses commands for stale sources or missing routes", async () => {
    const noCandidate = record("see", "none", []), stale = { ...projection([record("execute")]), sourceStates: [{ capability: "execute" as const, freshness: "stale" as const, policyVersion: "v1" }] };
    expect(projectHpmAttentionItems(projection([noCandidate]))).toEqual([]);
    const service = createHpmAttentionProjectionService({ routes: createHpmCommandRouteRegistry([route()]) });
    const result = await service.buildHpmAttentionProjection({ actor, lifecycleProjection: stale, attentionPolicyVersion: HPM_ATTENTION_POLICY_VERSION, commandVocabularyVersion: HPM_COMMAND_VOCABULARY_VERSION, correlationId: "c" });
    expect(result.ok && result.projection.items[0].validNextCommands).toEqual([]);
  });

  it("projects only registered, current, actor-eligible command descriptors", () => {
    const descriptor = record("execute").validNextCommands;
    const registry = createHpmCommandRouteRegistry([route()]);
    expect(projectHpmValidCommands({ descriptors: descriptor, actor, sourceFreshness: "current", registeredRoutes: registry })).toHaveLength(1);
    expect(projectHpmValidCommands({ descriptors: descriptor, actor: { ...actor, active: false }, sourceFreshness: "current", registeredRoutes: registry })).toEqual([]);
    expect(projectHpmValidCommands({ descriptors: descriptor, actor, sourceFreshness: "current", registeredRoutes: createHpmCommandRouteRegistry([]) })).toEqual([]);
  });
});

describe("HPM-001C command routing", () => {
  it("fails duplicate route registration at composition", () => {
    expect(() => createHpmCommandRouteRegistry([route(), route()])).toThrow("HPM_COMMAND_ROUTE_DUPLICATE");
  });

  it("reauthorizes and forwards expected version, idempotency, correlation, and causation", async () => {
    const authorize = vi.fn(async () => ({ allowed: true as const })), dispatch = vi.fn(async () => ({ ok: true as const, recordId: "execute", recordVersion: "4", classification: "ACTION_STARTED" }));
    const registered = { ...route(), authorize, dispatch };
    const refresh = vi.fn(async () => ({ ok: true }));
    const service = createHpmCommandRoutingService({ routes: createHpmCommandRouteRegistry([registered]), scopeResolver: { async resolve() { return { ok: true as const, scope }; } }, refresher: { refresh } });
    const result = await service.routeHpmCommand(routingRequest());
    expect(result).toMatchObject({ ok: true, resultingVersion: "4", projectionAction: "refreshed", correlationId: "correlation-1", idempotencyKey: "intent-1" });
    expect(authorize).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: "3", idempotencyKey: "intent-1", correlationId: "correlation-1", causationId: "attention-1" }), scope);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not dispatch when immediate reauthorization denies the command", async () => {
    const dispatch = vi.fn();
    const denied: HpmCommandRoute = { ...route(), async authorize() { return { allowed: false, classification: "HPM_COMMAND_ACCESS_DENIED" }; }, dispatch };
    const service = createHpmCommandRoutingService({ routes: createHpmCommandRouteRegistry([denied]), scopeResolver: { async resolve() { return { ok: true as const, scope }; } }, refresher: { async refresh() { return { ok: true }; } } });
    expect(await service.routeHpmCommand(routingRequest())).toMatchObject({ ok: false, code: "HPM_COMMAND_ACCESS_DENIED" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("maps version conflicts safely and requests a fresh projection", async () => {
    const refresh = vi.fn(async () => ({ ok: true }));
    const conflict = route("execute", "review-execute", { ok: false, classification: "HPM_COMMAND_VERSION_CONFLICT", message: "raw row details" });
    const service = createHpmCommandRoutingService({ routes: createHpmCommandRouteRegistry([conflict]), scopeResolver: { async resolve() { return { ok: true as const, scope }; } }, refresher: { refresh } });
    const result = await service.routeHpmCommand(routingRequest());
    expect(result).toMatchObject({ ok: false, status: "conflict", code: "HPM_COMMAND_VERSION_CONFLICT", projectionAction: "refresh-required" });
    expect(JSON.stringify(result)).not.toContain("raw row details");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("preserves successful mutation when projection refresh fails", async () => {
    const service = createHpmCommandRoutingService({ routes: createHpmCommandRouteRegistry([route()]), scopeResolver: { async resolve() { return { ok: true as const, scope }; } }, refresher: { async refresh() { throw new Error("refresh database failure"); } } });
    expect(await service.routeHpmCommand(routingRequest())).toMatchObject({ ok: true, projectionAction: "refresh-required", sourceClassification: "ACTION_STARTED" });
  });

  it("rejects inactive actors, client capability mismatch, unsupported routes, and missing idempotency", async () => {
    const service = createHpmCommandRoutingService({ routes: createHpmCommandRouteRegistry([route()]), scopeResolver: { async resolve() { return { ok: true as const, scope }; } }, refresher: { async refresh() { return { ok: true }; } } });
    expect(await service.routeHpmCommand(routingRequest({ actor: { ...actor, active: false } }))).toMatchObject({ code: "HPM_COMMAND_ACCESS_DENIED" });
    expect(await service.routeHpmCommand(routingRequest({ owningCapability: "decisions" }))).toMatchObject({ code: "HPM_COMMAND_INPUT_INVALID" });
    expect(await service.routeHpmCommand(routingRequest({ commandType: "autonomous-approve" }))).toMatchObject({ code: "HPM_COMMAND_NOT_SUPPORTED" });
    expect(await service.routeHpmCommand(routingRequest({ idempotencyKey: " " }))).toMatchObject({ code: "HPM_COMMAND_INPUT_INVALID" });
  });
});

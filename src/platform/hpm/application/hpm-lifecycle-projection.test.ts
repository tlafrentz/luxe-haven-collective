import { describe, expect, it } from "vitest";
import {
  HPM_FRESHNESS_POLICY_VERSION,
  HPM_HEALTH_POLICY_VERSION,
  HPM_LIFECYCLE_POLICY_VERSION,
  HPM_LINEAGE_POLICY_VERSION,
  HPM_SOURCE_CAPABILITIES,
  assembleHpmLineage,
  createHpmLifecycleProjectionService,
  createHpmSourcePortRegistry,
  createUnavailableHpmSourcePort,
  deriveCurrentLifecyclePosition,
  evaluateHpmFreshness,
  evaluateHpmHealth,
  type HpmActorContext,
  type HpmProjectedRecord,
  type HpmProjectionRequest,
  type HpmProjectionScope,
  type HpmSourceCapability,
  type HpmSourcePort,
} from ".";

const asOf = "2026-08-10T12:00:00.000Z";
const scope: HpmProjectionScope = Object.freeze({ tenantId: "tenant-1", type: "property", propertyIds: ["property-1"], timeZone: "America/Chicago", from: "2026-08-01", to: "2026-08-10" });
const actor: HpmActorContext = Object.freeze({ actorId: "actor-1", tenantId: "tenant-1", roleIds: ["owner"], propertyIds: ["property-1", "property-2"], active: true });
const policies = Object.freeze({ lifecycle: HPM_LIFECYCLE_POLICY_VERSION, health: HPM_HEALTH_POLICY_VERSION, lineage: HPM_LINEAGE_POLICY_VERSION, freshness: HPM_FRESHNESS_POLICY_VERSION });

function request(overrides: Partial<HpmProjectionRequest> = {}): HpmProjectionRequest {
  return { actor, scopeType: "property", scopeId: "property-1", asOf, correlationId: "correlation-1", policyVersions: policies, ...overrides };
}

function record(capability: HpmSourceCapability, id: string, overrides: Partial<HpmProjectedRecord> = {}): HpmProjectedRecord {
  const stage = capability === "observations" ? "see" : capability === "intelligence" ? "understand" : capability === "decisions" ? "decide" : capability === "execute" ? "execute" : capability === "recommendations" ? "recommend" : "learn";
  return Object.freeze({
    tenantId: "tenant-1",
    source: { capability, recordType: `${capability}-record`, recordId: id, recordVersion: "1" },
    stage,
    canonicalStatus: "active",
    presentationState: "in-progress",
    summary: `${capability} summary`,
    propertyIds: ["property-1"],
    attentionState: "none",
    validNextCommands: [],
    createdAt: "2026-08-09T10:00:00.000Z",
    updatedAt: "2026-08-09T11:00:00.000Z",
    visibility: "property",
    canonicalThreadId: "thread-1",
    ...overrides,
  });
}

function sourcePort(capability: HpmSourceCapability, records: readonly HpmProjectedRecord[] = [record(capability, `${capability}-1`)]): HpmSourcePort {
  return Object.freeze({
    capability,
    contractVersion: "v1",
    async project() {
      return Object.freeze({ state: Object.freeze({ capability, freshness: "current" as const, observedAt: "2026-08-10T11:45:00.000Z", lastSuccessfulAsOf: "2026-08-10T11:45:00.000Z", sourceVersion: "checkpoint-1", policyVersion: `${capability}-v1` }), records });
    },
  });
}

function service(ports: readonly HpmSourcePort[], resolvedScope = scope) {
  return createHpmLifecycleProjectionService({
    sources: createHpmSourcePortRegistry(ports),
    scopeAuthorizer: { async resolve() { return { ok: true as const, scope: resolvedScope }; } },
    now: () => asOf,
  });
}

describe("HPM-001B lifecycle projection", () => {
  it("builds a complete deterministic property projection with all six stages", async () => {
    const ports = HPM_SOURCE_CAPABILITIES.map((capability) => sourcePort(capability));
    const application = service(ports);
    const first = await application.buildHpmLifecycleProjection(request());
    const second = await application.buildHpmLifecycleProjection(request());
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.projection.completeness).toBe("complete");
    expect(first.projection.stages.map(({ stage }) => stage)).toEqual(["see", "understand", "decide", "execute", "learn", "recommend"]);
    expect(first.projection.stages.find(({ stage }) => stage === "learn")?.visibleCount).toBe(2);
    expect(first.projection.threads).toHaveLength(1);
    expect(first.projection.attention).toEqual([]);
    expect(first.projection.validNextCommands).toEqual([]);
    expect(first.projection.reports).toEqual([]);
  });

  it("builds portfolio totals only from authorized member properties", async () => {
    const portfolioScope: HpmProjectionScope = { ...scope, type: "portfolio", portfolioId: "portfolio-1", propertyIds: ["property-1"] };
    const seeRecords = [record("observations", "visible"), record("observations", "excluded", { propertyIds: ["property-2"] }), record("observations", "restricted", { visibility: "restricted" })];
    const ports = HPM_SOURCE_CAPABILITIES.map((capability) => sourcePort(capability, capability === "observations" ? seeRecords : []));
    const result = await service(ports, portfolioScope).buildHpmLifecycleProjection(request({ scopeType: "portfolio", scopeId: "portfolio-1" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.projection.stages.find(({ stage }) => stage === "see")?.visibleCount).toBe(1);
  });

  it("returns safe partial results without fabricating unavailable learning or recommendation records", async () => {
    const ports = HPM_SOURCE_CAPABILITIES.map((capability) => capability === "learning" || capability === "recommendations" ? createUnavailableHpmSourcePort(capability) : sourcePort(capability));
    const result = await service(ports).buildHpmLifecycleProjection(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projection.completeness).toBe("partial");
    expect(result.projection.coverage).toMatchObject({ applicableSources: 7, availableSources: 5 });
    expect(result.projection.stages.find(({ stage }) => stage === "recommend")).toMatchObject({ availability: "not-configured", visibleCount: 0 });
  });

  it("sanitizes source failures while retaining independent source data", async () => {
    const ports = HPM_SOURCE_CAPABILITIES.map((capability) => capability === "intelligence" ? Object.freeze({ ...sourcePort(capability), async project() { throw new Error("database password and raw SQL"); } }) : sourcePort(capability));
    const result = await service(ports).buildHpmLifecycleProjection(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projection.failures).toEqual([{ capability: "intelligence", classification: "HPM_SOURCE_UNAVAILABLE", message: "A lifecycle source is unavailable." }]);
    expect(JSON.stringify(result)).not.toContain("database password");
  });

  it("prefers explicit lineage and labels deterministic correlation inference", () => {
    const observation = record("observations", "o1", { correlationId: "c1", relationships: [{ type: "supports", target: { capability: "decisions", recordType: "decisions-record", recordId: "d1", recordVersion: "1" }, authority: "explicit", explanationCode: "canonical-link" }] });
    const finding = record("intelligence", "i1", { correlationId: "c1", canonicalThreadId: undefined });
    const decision = record("decisions", "d1", { correlationId: "c1" });
    const result = assembleHpmLineage([observation, finding, decision], scope);
    expect(result.edges.some(({ authority, explanationCode }) => authority === "explicit" && explanationCode === "canonical-link")).toBe(true);
    expect(result.edges.some(({ authority, explanationCode }) => authority === "inferred" && explanationCode === "shared-visible-correlation")).toBe(true);
  });

  it("rejects self, broken, and cross-tenant lineage endpoints", () => {
    const source = record("observations", "o1", { relationships: [
      { type: "supports", target: { capability: "observations", recordType: "observations-record", recordId: "o1", recordVersion: "1" }, authority: "explicit", explanationCode: "self" },
      { type: "supports", target: { capability: "decisions", recordType: "decisions-record", recordId: "missing", recordVersion: "1" }, authority: "explicit", explanationCode: "broken" },
      { type: "supports", target: { capability: "decisions", recordType: "decisions-record", recordId: "foreign", recordVersion: "1" }, authority: "explicit", explanationCode: "foreign" },
    ] });
    const foreign = record("decisions", "foreign", { tenantId: "tenant-2" });
    const result = assembleHpmLineage([source, foreign], scope);
    expect(result.edges).toEqual([]);
    expect(result.gaps.map(({ code }) => code)).toEqual(["lineage-endpoint-unavailable", "lineage-invalid", "lineage-invalid"]);
  });

  it("applies deterministic health precedence without replacing source status", () => {
    const source = record("execute", "a1").source;
    const result = evaluateHpmHealth({ evaluatedAt: asOf, applicable: true, freshness: ["stale"], signals: [
      { code: "authorization-awaiting", source, explanation: "Approval is required." },
      { code: "critical-execution-blocked", source, explanation: "Critical execution is blocked." },
    ] });
    expect(result.state).toBe("blocked");
    expect(result.reasonCodes).toEqual(["authorization-awaiting", "critical-execution-blocked"]);
  });

  it("uses source-specific freshness thresholds and preserves last successful time", () => {
    const state = evaluateHpmFreshness({ capability: "observations", freshness: "current", observedAt: "2026-08-09T10:00:00.000Z", lastSuccessfulAsOf: "2026-08-09T10:00:00.000Z", policyVersion: "observations-v1" }, asOf);
    expect(state).toMatchObject({ freshness: "stale", lastSuccessfulAsOf: "2026-08-09T10:00:00.000Z", reasonCode: "source-stale" });
  });

  it("keeps an earlier blocker authoritative and moves implemented work awaiting measurement to Learn", () => {
    expect(deriveCurrentLifecyclePosition([record("decisions", "d1", { blocker: "Authority required", presentationState: "blocked" }), record("recommendations", "r1")])).toBe("decide");
    expect(deriveCurrentLifecyclePosition([record("execute", "a1", { presentationState: "completed", healthSignals: [{ code: "measurement-awaiting", source: record("execute", "a1").source, explanation: "Measurement is due." }] })])).toBe("learn");
  });

  it("rejects unsupported policy versions and denied scopes before source aggregation", async () => {
    const ports = HPM_SOURCE_CAPABILITIES.map((capability) => sourcePort(capability));
    const mismatch = await service(ports).buildHpmLifecycleProjection(request({ policyVersions: { ...policies, health: "future" } }));
    expect(mismatch).toMatchObject({ ok: false, code: "HPM_PROJECTION_POLICY_MISMATCH" });
    const denied = createHpmLifecycleProjectionService({ sources: createHpmSourcePortRegistry(ports), scopeAuthorizer: { async resolve() { return { ok: false as const, code: "HPM_SCOPE_ACCESS_DENIED" as const }; } } });
    expect(await denied.buildHpmLifecycleProjection(request())).toMatchObject({ ok: false, code: "HPM_SCOPE_ACCESS_DENIED" });
  });

  it("does not invoke an unsupported source contract and safely reports the conflict", async () => {
    let invoked = false;
    const ports = HPM_SOURCE_CAPABILITIES.map((capability) => capability === "decisions" ? Object.freeze({ capability, contractVersion: "v99", async project() { invoked = true; return sourcePort(capability).project({ scope, actor, correlationId: "c", requestedAt: asOf }); } }) : sourcePort(capability));
    const result = await service(ports).buildHpmLifecycleProjection(request());
    expect(invoked).toBe(false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.projection.failures).toContainEqual({ capability: "decisions", classification: "HPM_SOURCE_VERSION_CONFLICT", message: "A lifecycle source is unavailable." });
  });

  it("sanitizes scope resolver failures", async () => {
    const ports = HPM_SOURCE_CAPABILITIES.map((capability) => sourcePort(capability));
    const application = createHpmLifecycleProjectionService({ sources: createHpmSourcePortRegistry(ports), scopeAuthorizer: { async resolve() { throw new Error("raw authorization database details"); } } });
    const result = await application.buildHpmLifecycleProjection(request());
    expect(result).toEqual({ ok: false, code: "HPM_PROJECTION_UNAVAILABLE", message: "The HPM scope could not be resolved." });
    expect(JSON.stringify(result)).not.toContain("database");
  });
});

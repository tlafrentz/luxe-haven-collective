import { describe, expect, it } from "vitest";
import type { HpmAttentionProjection, HpmLifecycleProjection } from "../application";
import { HPM_METRIC_DEFINITIONS } from "./hpm-metric-registry";
import { HpmOperationAdmissionService, projectHpmOperationalHealth } from "./hpm-operations";
import { BoundedHpmReportCache, hpmReportCacheKey } from "./hpm-report-cache";
import { HPM_STANDARD_REPORTS } from "./hpm-report-catalog";
import type { HpmReportRequest } from "./hpm-report-contracts";
import { createHpmReportExport } from "./hpm-report-export";
import { createHpmReportService } from "./hpm-report-service";

const at = "2026-08-09T12:00:00.000Z", scope = { tenantId: "tenant-1", type: "portfolio" as const, portfolioId: "tenant-1", propertyIds: ["property-1"], timeZone: "America/Chicago", from: "2026-07-01T00:00:00.000Z", to: "2026-08-09T23:59:59.999Z" };
const ref = { capability: "execute" as const, recordType: "action", recordId: "action-1", recordVersion: "1" };
const stages = (["see", "understand", "decide", "execute", "learn", "recommend"] as const).map((stage) => ({ stage, availability: stage === "execute" ? "available" as const : "not-configured" as const, visibleCount: stage === "execute" ? 2 : 0, attentionCount: stage === "execute" ? 1 : 0, health: stage === "execute" ? "blocked" as const : "incomplete-context" as const, freshness: stage === "execute" ? "current" as const : "not-configured" as const, asOf: at }));
const thread = { threadKey: "thread-1", scope, origin: ref, records: [], relationships: [], currentStage: "execute" as const, health: "blocked" as const, healthReasons: ["blocked"], blockers: ["Access unavailable"], missingStages: ["see", "understand", "decide", "learn", "recommend"] as const, timeline: [], partial: true, freshness: "current" as const, firstObservedAt: at, lastChangedAt: at, asOf: at };
const lifecycle = { projectionPolicyVersion: "hpm-projection-v1", scope, projectedAt: at, asOf: at, health: "blocked", healthReasons: ["blocked"], stages, attention: [], threads: [thread], recentlyChanged: [], lineage: [], sourceStates: [{ capability: "execute", contractVersion: "v1", freshness: "current", policyVersion: "execute-v1" }, { capability: "learning", contractVersion: "unavailable-v1", freshness: "not-configured", policyVersion: "unavailable-v1" }], partial: true, completeness: "partial", coverage: { applicableSources: 2, availableSources: 1, limitations: ["learning:source-not-configured"] }, failures: [], validNextCommands: [], reports: [] } as HpmLifecycleProjection;
const attention = { projectionKey: "attention", scope, asOf: at, policyVersions: { lifecycle: "v1", attention: "v1", command: "v1" }, completeness: "partial", totalAuthorizedCandidates: 1, items: [{ id: "a", rank: 1, reason: "blocked", rankExplanation: "Blocked execution", stage: "execute", authoritativeRecord: ref, scope, severity: "critical" }], groups: { byStage: { execute: 1 }, byCapability: { execute: 1 }, byClassification: {} }, sourceStates: lifecycle.sourceStates, failures: [], projectedAt: at, pagination: { limit: 50, returned: 1, hasMore: false } } as HpmAttentionProjection;
const request = (reportKey: HpmReportRequest["reportKey"] = "executive-summary", overrides: Partial<HpmReportRequest> = {}): HpmReportRequest => ({ reportKey, actor: { actorId: "actor-1", tenantId: "tenant-1", roleIds: ["owner"], propertyIds: ["property-1"], active: true }, scope, dateMode: "period", from: scope.from, to: scope.to, timeZone: scope.timeZone, asOf: at, filters: {}, dimensions: [], locale: "en-US", currency: "USD", correlationId: "correlation-1", ...overrides });

describe("HPM-001E reporting and operations", () => {
  it("publishes ten immutable reports whose metrics all resolve to complete definitions", () => {
    expect(HPM_STANDARD_REPORTS).toHaveLength(10);
    for (const report of HPM_STANDARD_REPORTS) for (const metric of report.metricReferences) expect(HPM_METRIC_DEFINITIONS.find((definition) => definition.key === metric.key && definition.version === metric.version)).toMatchObject({ numerator: expect.any(String), denominator: expect.any(String), timeZoneTreatment: expect.any(String), scopeRules: expect.any(String), policyVersion: "hpm-metrics-v1" });
    expect(Object.isFrozen(HPM_STANDARD_REPORTS)).toBe(true);
  });

  it.each(HPM_STANDARD_REPORTS.map(({ key }) => key))("assembles %s reproducibly without replacing unavailable sources with zero", (key) => {
    const service = createHpmReportService({ now: () => at });
    const property = key === "property-performance-lifecycle", selectedScope = property ? { ...scope, type: "property" as const, portfolioId: undefined, propertyIds: ["property-1"] } : scope;
    const selectedLifecycle = property ? { ...lifecycle, scope: selectedScope, threads: lifecycle.threads.map((item) => ({ ...item, scope: selectedScope })) } : lifecycle, selectedAttention = property ? { ...attention, scope: selectedScope, items: attention.items.map((item) => ({ ...item, scope: selectedScope })) } : attention;
    const selectedRequest = request(key, { scope: selectedScope });
    const first = service.run({ request: selectedRequest, lifecycle: selectedLifecycle, attention: selectedAttention }), second = service.run({ request: selectedRequest, lifecycle: selectedLifecycle, attention: selectedAttention });
    expect(first.ok).toBe(true); expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.report.resultChecksum).toBe(second.report.resultChecksum);
    expect(first.report.runId).toBe(second.report.runId);
    expect(first.report.completeness).toBe("partial");
    expect(first.report.sections.find(({ key: section }) => section === "lifecycle")?.rows.find(({ id }) => id === "learn")?.values[0]).toMatchObject({ value: null, state: "unavailable" });
  });

  it("authorizes before aggregation and rejects cross-tenant, property, dimension, and date inputs", () => {
    const service = createHpmReportService();
    expect(service.run({ request: request("executive-summary", { actor: { ...request().actor, tenantId: "other" } }), lifecycle, attention })).toMatchObject({ ok: false, code: "HPM_REPORT_ACCESS_DENIED" });
    expect(service.run({ request: request("executive-summary", { dimensions: ["guest"] }), lifecycle, attention })).toMatchObject({ ok: false, code: "HPM_REPORT_DIMENSION_INVALID" });
    expect(service.run({ request: request("executive-summary", { from: "2026-09-01T00:00:00Z", to: "2026-08-01T00:00:00Z" }), lifecycle, attention })).toMatchObject({ ok: false, code: "HPM_REPORT_DATE_RANGE_INVALID" });
  });

  it("reconciles report totals to authorized detail and distinguishes empty populations from zero", () => {
    const result = createHpmReportService().run({ request: request(), lifecycle, attention }); expect(result.ok).toBe(true); if (!result.ok) return;
    const total = result.report.sections.flatMap(({ metrics }) => metrics).find(({ metricKey }) => metricKey === "stage-visible-count");
    const rows = result.report.sections.find(({ key }) => key === "lifecycle")!.rows;
    expect(total?.value).toBe(rows.reduce((sum, row) => sum + Number(row.values[0].value ?? 0), 0));
    expect(result.report.sections.flatMap(({ metrics }) => metrics).find(({ metricKey }) => metricKey === "healthy-thread-rate")).toMatchObject({ value: 0, state: "available", numerator: 0, denominator: 1 });
  });

  it("generates deterministic, safe CSV and print exports from the same canonical result", () => {
    const result = createHpmReportService({ now: () => at }).run({ request: request(), lifecycle, attention }); if (!result.ok) throw new Error("report failed");
    const csv = createHpmReportExport(result.report, "csv", new Date(at)), print = createHpmReportExport(result.report, "print", new Date(at));
    expect(csv.filename).toBe("hpm-executive-summary-2026-08-09.csv"); expect(csv.content).toContain(result.report.resultChecksum); expect(csv.content).toContain("Unavailable");
    expect(print.content).toContain(result.report.resultChecksum); expect(print.content).toContain("<caption>");
    expect(createHpmReportExport(result.report, "csv", new Date(at)).exportId).toBe(csv.exportId);
  });

  it("isolates cache keys by actor permissions, scope, policy, and source fingerprint", () => {
    const base = { request: request(), definitionVersion: "v1", metricPolicyVersions: { metric: "v1" }, sourceFingerprint: "source-v1", permissionFingerprint: "owner" };
    const key = hpmReportCacheKey(base); expect(hpmReportCacheKey({ ...base, permissionFingerprint: "viewer" })).not.toBe(key); expect(hpmReportCacheKey({ ...base, sourceFingerprint: "source-v2" })).not.toBe(key);
    const cache = new BoundedHpmReportCache(1, 10); const result = createHpmReportService().run({ request: request(), lifecycle, attention }); if (!result.ok) throw new Error("report failed"); cache.set(key, result.report, 0); expect(cache.get(key, 5)).toBe(result.report); expect(cache.get(key, 11)).toBeUndefined();
  });

  it("projects safe degraded health and admits only bounded, authorized, idempotent jobs", () => {
    const health = projectHpmOperationalHealth({ lifecycle, flags: { reports: true, exports: true, health: true, operations: true }, evaluatedAt: at }); expect(health.status).toBe("partial"); expect(health.degradedModes).toContain("learning:not-configured");
    const service = new HpmOperationAdmissionService(), input = { actorId: "actor-1", tenantId: "tenant-1", roleIds: ["owner"], type: "rebuild-projection" as const, scopeType: "portfolio" as const, scopeId: "tenant-1", reason: "Rehearse bounded projection recovery", idempotencyKey: "job-1", correlationId: "c", causationId: "cause", dryRun: true, maximumRecords: 100, maximumDurationMs: 10_000 };
    expect(service.request(input)).toMatchObject({ status: "dry-run-complete", classification: "HPM_OPERATION_DRY_RUN_VALID" }); expect(service.request(input).id).toBe(service.request(input).id); expect(service.size).toBe(1);
    expect(() => service.request({ ...input, roleIds: ["viewer"], idempotencyKey: "job-2" })).toThrow("HPM_REBUILD_NOT_ALLOWED"); expect(() => service.request({ ...input, maximumRecords: 10_001, idempotencyKey: "job-3" })).toThrow("HPM_REBUILD_SCOPE_TOO_BROAD");
  });
});

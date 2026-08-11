import { describe, expect, it } from "vitest";
import { assertSnapshot, normalizeScope, ReportFoundationError, standardReportRegistry, transitionReportVersion, validateGenerateReportRequest, validatePeriod, type ReportAuthorization, type ReportSnapshot } from ".";

const tenantId = "11111111-1111-4111-8111-111111111111", propertyA = "22222222-2222-4222-8222-222222222222", propertyB = "33333333-3333-4333-8333-333333333333";
const actor = { userId: "user-1", tenantId, authenticated: true } as const;
const allow: ReportAuthorization = { authorize: async () => ({ allowed: true, authorizedPropertyIds: [propertyA, propertyB] }) };
const period = { startDate: "2026-07-01", endDate: "2026-07-31", timezone: "America/Chicago" } as const;

describe("RP-001A reporting foundation", () => {
  it("registers exactly six stable v1 definitions with deterministic owner-safe sections", () => {
    expect(standardReportRegistry.list()).toHaveLength(6);
    expect(new Set(standardReportRegistry.list().map(item => item.definitionId)).size).toBe(6);
    const owner = standardReportRegistry.get("owner.performance-report.v1", 1);
    expect(owner.sectionDefinitions.every(section => section.visibility === "owner_safe")).toBe(true);
    expect(owner.sectionDefinitions.map(section => section.order)).toEqual(owner.sectionDefinitions.map((_, index) => index));
    expect(() => standardReportRegistry.get("unknown.v1")).toThrowError(ReportFoundationError);
  });

  it("normalizes, deduplicates, and orders property scope", () => {
    expect(normalizeScope({ kind: "selected_properties", tenantId, propertyIds: [propertyB, propertyA, propertyB] })).toEqual({ kind: "selected_properties", tenantId, propertyIds: [propertyA, propertyB] });
    expect(() => normalizeScope({ kind: "selected_properties", tenantId, propertyIds: [] })).toThrow("must not be empty");
  });

  it("validates exact dates, timezone, scope compatibility, and every property grant", async () => {
    expect(validatePeriod(period)).toEqual(period);
    expect(() => validatePeriod({ ...period, startDate: "2026-08-01" })).toThrow("invalid");
    const valid = await validateGenerateReportRequest({ definitionId: "operations.performance-report.v1", scope: { kind: "selected_properties", tenantId, propertyIds: [propertyA, propertyB] }, period }, actor, allow);
    expect(valid.scope.kind).toBe("selected_properties");
    await expect(validateGenerateReportRequest({ definitionId: "owner.performance-report.v1", scope: { kind: "selected_properties", tenantId, propertyIds: [propertyA] }, period }, actor, allow)).rejects.toMatchObject({ code: "REPORT_SCOPE_UNSUPPORTED" });
    await expect(validateGenerateReportRequest({ definitionId: "operations.performance-report.v1", scope: { kind: "selected_properties", tenantId, propertyIds: [propertyA, propertyB] }, period }, actor, { authorize: async () => ({ allowed: true, authorizedPropertyIds: [propertyA] }) })).rejects.toMatchObject({ code: "REPORT_SCOPE_FORBIDDEN" });
  });

  it("keeps missing values distinct from zero and rejects unregistered metrics", () => {
    const snapshot: ReportSnapshot = { schemaVersion: "rp001.report-snapshot.v1", sections: [{ sectionId: "summary", sectionType: "summary", title: "Summary", order: 0, visibility: "standard", status: "partial", metrics: [{ metricId: "m1", metricKey: "occupancy", label: "Occupancy", value: null, valueType: "percentage", status: "missing", lineage: [] }, { metricId: "m2", metricKey: "revenue", label: "Revenue", value: 0, valueType: "currency", currency: "USD", status: "available", lineage: [] }], findings: [], recommendations: [], dataGaps: [{ gapId: "g1", code: "SOURCE_MISSING", category: "missing", severity: "limiting", message: "Occupancy is unavailable.", affectedMetricKeys: ["occupancy"] }] }], lineage: [], freshness: { status: "unknown" }, dataGaps: [] };
    const result = assertSnapshot(snapshot, new Set(["occupancy", "revenue"]));
    expect(result.sections[0]?.metrics.map(metric => metric.value)).toEqual([null, 0]);
    expect(() => assertSnapshot(snapshot, new Set(["revenue"]))).toThrow("not registered");
    expect(Object.isFrozen(result.sections)).toBe(true);
  });

  it("enforces immutable-ready lifecycle semantics", () => {
    expect(transitionReportVersion("generating", "ready")).toBe("ready");
    expect(() => transitionReportVersion("ready", "generating")).toThrow("cannot transition");
  });
});

import { describe, expect, it } from "vitest";
import type { Report, ReportSnapshot, ReportVersion } from "./model";
import { ReportFoundationError } from "./model";
import type { ReportActor } from "./application";
import type { ReportGenerationRepository, ReportSourceData } from "./generation";
import { compare, ReportGenerator } from "./generation";
import { InvestmentReportDataAdapter } from "./data-providers";

const tenantId = "11111111-1111-4111-8111-111111111111", propertyId = "22222222-2222-4222-8222-222222222222";
const actor: ReportActor = { authenticated: true, tenantId, userId: "33333333-3333-4333-8333-333333333333" };
const period = { startDate: "2026-07-01", endDate: "2026-07-31", timezone: "America/Chicago" } as const;
const comparisonPeriod = { kind: "previous_period", startDate: "2026-06-01", endDate: "2026-06-30", timezone: "America/Chicago" } as const;
const scopes = {
  executive: { kind: "portfolio", tenantId } as const,
  owner: { kind: "property", tenantId, propertyId } as const,
  investmentAnalysis: { kind: "investment_opportunity", tenantId, opportunityId: "opp-1", analysisVersionId: "analysis-1" } as const,
  investmentComparison: { kind: "investment_comparison", tenantId, opportunityIds: ["opp-1", "opp-2"], analysisVersionIds: ["analysis-1", "analysis-2"] } as const,
  operations: { kind: "property", tenantId, propertyId } as const,
};
const available = (value: number) => ({ status: "available" as const, value, freshness: { status: "current" as const, observedAt: "2026-07-31T23:59:00Z" }, lineage: [{ sourceType: "platform_metric" as const, sourceKey: "canonical", sourceVersionId: "v1" }] });
const source: ReportSourceData = { metrics: { "gross-revenue": available(0), "occupancy-rate": available(0.75), "investment-score": available(82), "projected-annual-revenue": available(100000), "total-bookings": available(4) }, comparisonMetrics: { "gross-revenue": available(0), "occupancy-rate": available(0.5) } };

class MemoryRepository implements ReportGenerationRepository {
  reports = new Map<string, Report>(); versions = new Map<string, ReportVersion>(); keys = new Map<string, { fingerprint: string; versionId: string }>();
  async reserveGeneration(input: Parameters<ReportGenerationRepository["reserveGeneration"]>[0]) { const key = input.idempotencyKey ? `${input.actor.tenantId}:${input.actor.userId}:${input.idempotencyKey}` : undefined; const prior = key ? this.keys.get(key) : undefined; if (prior) { if (prior.fingerprint !== input.requestFingerprint) throw new ReportFoundationError("REPORT_IDEMPOTENCY_CONFLICT", "conflict"); return { version: this.versions.get(prior.versionId)!, replay: true }; } if (input.report) this.reports.set(input.report.reportId, input.report); const number = [...this.versions.values()].filter(item => item.reportId === input.reportId).length + 1; const version: ReportVersion = { reportId: input.reportId, reportVersionId: input.versionId, versionNumber: number, definitionId: input.definition.definitionId, definitionVersion: input.definition.definitionVersion, family: input.definition.family, reportType: input.definition.reportType, title: input.title, tenantId: input.actor.tenantId, requestedBy: input.actor.userId, scope: input.scope, authorizedPropertyIds: input.propertyIds, status: "draft", period: input.period, ...(input.comparisonPeriod ? { comparisonPeriod: input.comparisonPeriod } : {}), requestedAt: input.requestedAt }; this.versions.set(version.reportVersionId, version); if (key) this.keys.set(key, { fingerprint: input.requestFingerprint, versionId: version.reportVersionId }); return { version, replay: false }; }
  async createReport(input: Report) { this.reports.set(input.reportId, input); return input; } async createVersion(input: ReportVersion) { this.versions.set(input.reportVersionId, input); return input; }
  async markGenerating(id: string) { this.replace(id, { status: "generating", generationStartedAt: "2026-08-11T12:00:00Z" }); }
  async markReady(id: string, snapshot: ReportSnapshot) { this.replace(id, { status: "ready", snapshot, generatedAt: (snapshot as { generatedAt?: string }).generatedAt ?? "2026-08-11T12:00:00Z" }); }
  async markFailed(id: string, failure: { code: string; message: string }) { this.replace(id, { status: "failed", failureCode: failure.code, failureMessage: failure.message }); }
  async getReport(id: string, context: ReportActor) { return this.reports.get(id)?.tenantId === context.tenantId ? this.reports.get(id)! : null; }
  async getVersion(reportId: string, id: string, context: ReportActor) { const value = this.versions.get(id); return value?.reportId === reportId && value.tenantId === context.tenantId ? value : null; }
  async listReports(context: ReportActor) { return [...this.reports.values()].filter(item => item.tenantId === context.tenantId && !item.archivedAt); }
  async listVersions(reportId: string, context: ReportActor) { return [...this.versions.values()].filter(item => item.reportId === reportId && item.tenantId === context.tenantId).sort((a, b) => b.versionNumber - a.versionNumber); }
  async archiveReport(id: string, context: ReportActor) { const value = await this.getReport(id, context); if (value) this.reports.set(id, { ...value, archivedAt: "2026-08-11T12:00:00Z" }); }
  async restoreReport(id: string, context: ReportActor) { const value = await this.getReport(id, context); if (value) { const { archivedAt: _, ...active } = value; void _; this.reports.set(id, active); } }
  private replace(id: string, patch: Partial<ReportVersion>) { const current = this.versions.get(id)!; if (["ready", "failed"].includes(current.status)) throw new Error("terminal"); this.versions.set(id, { ...current, ...patch }); }
}

function setup(providerSource: ReportSourceData = source) { const repository = new MemoryRepository(), events: string[] = []; let id = 0; const generator = new ReportGenerator({ repository, authorization: { authorize: async ({ scope }) => ({ allowed: scope.tenantId === tenantId, authorizedPropertyIds: [propertyId] }) }, providers: { get: () => ({ load: async () => providerSource }) }, telemetry: { emit: event => { events.push(event); } }, clock: () => "2026-08-11T12:00:00Z", id: () => `id-${++id}` }); return { repository, events, generator }; }

describe("RP-001C report generation", () => {
  it.each([
    ["executive.performance-brief.v1", scopes.executive, undefined],
    ["owner.performance-report.v1", scopes.owner, undefined],
    ["investment.analysis-report.v1", scopes.investmentAnalysis, undefined],
    ["investment.comparison-report.v1", scopes.investmentComparison, undefined],
    ["operations.performance-report.v1", scopes.operations, undefined],
    ["custom.report.v1", scopes.executive, { sectionKeys: ["executive-summary"] }],
  ])("generates %s in exact catalog order", async (definitionId, scope, customConfiguration) => { const { generator, repository, events } = setup(); const result = await generator.execute({ definitionId, scope, period, ...(definitionId.includes("investment") ? {} : { comparisonPeriod }), ...(customConfiguration ? { customConfiguration } : {}) }, actor); const version = repository.versions.get(result.versionId)!; expect(version.status).toBe("ready"); expect(version.snapshot?.sections.map(item => item.order)).toEqual(version.snapshot?.sections.map((_, index) => index)); expect(events.filter(event => event.endsWith("completed") || event.endsWith("failed"))).toEqual(["report_generation_completed"]); });

  it("preserves zero, missing, lineage, and zero-denominator comparison semantics", async () => { const { generator, repository } = setup(); const result = await generator.execute({ definitionId: "executive.performance-brief.v1", scope: scopes.executive, period, comparisonPeriod }, actor); const metrics = repository.versions.get(result.versionId)!.snapshot!.sections.flatMap(item => item.metrics); expect(metrics.find(item => item.metricKey === "gross-revenue")).toMatchObject({ value: 0, status: "available", comparison: { status: "not_calculable", absoluteChange: 0 } }); expect(metrics.find(item => item.metricKey === "average-daily-rate")).toMatchObject({ value: null, status: "missing" }); expect(metrics.find(item => item.metricKey === "occupancy-rate")?.lineage[0]?.sourceVersionId).toBe("v1"); expect(compare(4, available(2), comparisonPeriod)).toMatchObject({ absoluteChange: 2, percentageChange: 1 }); });

  it("replays identical idempotent requests and rejects changed input", async () => { const { generator, repository } = setup(); const request = { definitionId: "operations.performance-report.v1", scope: scopes.operations, period, idempotencyKey: "same" } as const; const first = await generator.execute(request, actor), replay = await generator.execute(request, actor); expect(replay).toEqual(first); expect(repository.versions.size).toBe(1); await expect(generator.execute({ ...request, title: "Changed" }, actor)).rejects.toMatchObject({ code: "REPORT_IDEMPOTENCY_CONFLICT" }); });

  it("regenerates to a new immutable historical version", async () => { const { generator, repository } = setup(); const request = { definitionId: "owner.performance-report.v1", scope: scopes.owner, period } as const; const first = await generator.execute(request, actor); const second = await generator.regenerate(first.reportId, request, actor); expect(second.versionNumber).toBe(2); expect(repository.versions.get(first.versionId)?.versionNumber).toBe(1); expect(repository.versions.get(first.versionId)?.status).toBe("ready"); });

  it("fails closed before source loading for unauthorized scope", async () => { const { generator, repository } = setup(); await expect(generator.execute({ definitionId: "operations.performance-report.v1", scope: { kind: "property", tenantId: "other", propertyId }, period }, actor)).rejects.toMatchObject({ code: "REPORT_SCOPE_FORBIDDEN" }); expect(repository.versions.size).toBe(0); });

  it("persists provider failure without partial ready content", async () => { const repository = new MemoryRepository(); const generator = new ReportGenerator({ repository, authorization: { authorize: async () => ({ allowed: true, authorizedPropertyIds: [propertyId] }) }, providers: { get: () => ({ load: async () => { throw new Error("provider secret"); } }) }, id: (() => { let id = 0; return () => `failure-${++id}`; })() }); await expect(generator.execute({ definitionId: "owner.performance-report.v1", scope: scopes.owner, period }, actor)).rejects.toMatchObject({ code: "REPORT_GENERATION_FAILED" }); const version = [...repository.versions.values()][0]!; expect(version).toMatchObject({ status: "failed", failureCode: "REPORT_GENERATION_FAILED" }); expect(version.snapshot).toBeUndefined(); expect(version.failureMessage).not.toContain("provider secret"); });

  it("structurally keeps owner snapshots owner-safe and blocks internal source content", async () => { const safe = setup({ ...source, findings: [{ id: "safe", category: "owner-summary", severity: "positive", title: "Owner update", summary: "Observed result", metricKeys: [], lineage: [], visibility: "owner_safe" }] }); const result = await safe.generator.execute({ definitionId: "owner.performance-report.v1", scope: scopes.owner, period }, actor); expect(safe.repository.versions.get(result.versionId)!.snapshot!.sections.every(item => item.visibility === "owner_safe")).toBe(true); const unsafe = setup({ ...source, findings: [{ id: "internal", category: "owner-summary", severity: "attention", title: "Internal", summary: "Staff-only", metricKeys: [], lineage: [], visibility: "internal" }] }); await expect(unsafe.generator.execute({ definitionId: "owner.performance-report.v1", scope: scopes.owner, period }, actor)).rejects.toMatchObject({ code: "REPORT_DISCLOSURE_VIOLATION" }); expect([...unsafe.repository.versions.values()][0]?.status).toBe("failed"); });

  it("requires exact saved investment-version lineage from the canonical adapter", async () => { const input = { tenantId, requesterId: actor.userId, definition: {} as never, scope: scopes.investmentAnalysis, period, propertyIds: [], correlationId: "c" }; const missing = new InvestmentReportDataAdapter(async () => source); await expect(missing.load(input)).rejects.toThrow("immutable analysis version"); const exact = new InvestmentReportDataAdapter(async () => ({ metrics: { "investment-score": { ...available(82), lineage: [{ sourceType: "investment_analysis", sourceVersionId: "analysis-1" }] } } })); await expect(exact.load(input)).resolves.toBeDefined(); });
});

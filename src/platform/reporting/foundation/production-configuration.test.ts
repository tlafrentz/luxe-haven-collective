import { describe, expect, it, vi } from "vitest";
import {
  ExpireReportArtifacts,
  type ReportArtifactStorage,
  type ReportExport,
  type ReportExportRepository,
} from "./exports";
import { parseReportingProductionConfiguration } from "./production-configuration";
const flags = {
  REPORTING_ENABLED: "true",
  REPORTING_CUSTOM_REPORTS_ENABLED: "true",
  REPORTING_PDF_EXPORTS_ENABLED: "true",
  REPORTING_CSV_EXPORTS_ENABLED: "true",
};
describe("RP-001F reporting configuration", () => {
  it("parses deliberate bounded defaults", () => {
    const value = parseReportingProductionConfiguration(flags);
    expect(value.exportRetentionDays).toBe(30);
    expect(value.maximumPdfPages).toBe(200);
  });
  it.each([
    { ...flags, REPORTING_MAX_PDF_PAGES: "0" },
    { ...flags, REPORTING_EXPORT_RETENTION_DAYS: "366" },
    { ...flags, REPORTING_ENABLED: "yes" },
  ])("rejects malformed or unsafe configuration", (env) =>
    expect(() => parseReportingProductionConfiguration(env)).toThrow(
      /configuration is invalid/,
    ),
  );
});
describe("RP-001F artifact cleanup", () => {
  it("deletes only the exact expired identity and preserves metadata", async () => {
    const target = {
        id: "export_1",
        tenantId: "tenant_1",
        reportId: "report_1",
        reportVersionId: "version_1",
        format: "pdf",
        status: "ready",
        options: {
          sectionKeys: [],
          includeComparison: true,
          includeFreshness: true,
          includeLineage: false,
        },
        requestedBy: "user_1",
        requestedAt: "2026-08-01T00:00:00Z",
        expiresAt: "2026-08-02T00:00:00Z",
        correlationId: "request_1",
        rendererVersion: "v1",
        idempotencyKey: "key",
        storageKey: "tenant_1/version_1/export_1/file.pdf",
      } as ReportExport,
      remove = vi.fn(async () => {}),
      expireExact = vi.fn(async () => true),
      events: string[] = [];
    const repository = {
        listExpired: async () => [target],
        expireExact,
        reserve: vi.fn(),
        markGenerating: vi.fn(),
        markReady: vi.fn(),
        markFailed: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
        expire: vi.fn(),
      } as unknown as ReportExportRepository,
      storage = {
        remove,
        store: vi.fn(),
        createDownloadAccess: vi.fn(),
      } as unknown as ReportArtifactStorage;
    const result = await new ExpireReportArtifacts({
      repository,
      storage,
      telemetry: { emit: (event) => { events.push(event); } },
    }).execute({
      asOf: new Date("2026-08-11T00:00:00Z"),
      batchSize: 10,
      correlationId: "cleanup_1",
    });
    expect(result).toEqual({ expired: 1, failed: 0 });
    expect(remove).toHaveBeenCalledWith(target.storageKey);
    expect(expireExact).toHaveBeenCalledWith(
      target.id,
      target.tenantId,
      target.storageKey,
    );
    expect(events).toContain("report_export_expired");
  });
  it("is idempotent when the compare-and-set no longer matches", async () => {
    const repository = {
        listExpired: async () => [],
        expireExact: vi.fn(),
      } as unknown as ReportExportRepository,
      storage = { remove: vi.fn() } as unknown as ReportArtifactStorage;
    expect(
      await new ExpireReportArtifacts({ repository, storage }).execute({
        asOf: new Date(),
        batchSize: 10,
        correlationId: "c",
      }),
    ).toEqual({ expired: 0, failed: 0 });
  });
});

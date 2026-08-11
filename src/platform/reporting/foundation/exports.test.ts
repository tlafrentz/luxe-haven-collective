import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  CUSTOM_REPORT_SECTION_REGISTRY,
  customReportOptions,
  normalizeCustomReportConfiguration,
} from "./custom-reports";
import {
  ReportExportService,
  csvCell,
  renderCanonicalReportPdf,
  renderCsvExport,
  type ReportArtifactStorage,
  type ReportExport,
  type ReportExportRepository,
} from "./exports";
import type { GeneratedReportSnapshot, ReportVersion } from "./model";
import { parseReportingProductionConfiguration } from "./production-configuration";
const configuration=parseReportingProductionConfiguration({REPORTING_ENABLED:"true",REPORTING_CUSTOM_REPORTS_ENABLED:"true",REPORTING_PDF_EXPORTS_ENABLED:"true",REPORTING_CSV_EXPORTS_ENABLED:"true"});

const snapshot = {
  schemaVersion: "rp001.report-snapshot.v1",
  definition: {
    definitionId: "executive.performance-brief.v1",
    definitionVersion: 1,
    family: "executive",
    reportType: "executive_performance_brief",
    title: "Executive Performance Brief",
  },
  report: {
    reportId: "report_1",
    versionId: "version_1",
    versionNumber: 1,
    title: "July Performance",
  },
  scope: {
    kind: "portfolio",
    tenantId: "11111111-1111-4111-8111-111111111111",
  },
  period: {
    startDate: "2026-07-01",
    endDate: "2026-08-01",
    timezone: "America/Chicago",
  },
  generatedAt: "2026-08-02T00:00:00.000Z",
  requestedBy: "22222222-2222-4222-8222-222222222222",
  sections: [
    {
      sectionId: "revenue-performance",
      sectionType: "performance",
      title: "Revenue Performance",
      order: 0,
      visibility: "internal",
      status: "partial",
      metrics: [
        {
          metricId: "gross-revenue",
          metricKey: "gross-revenue",
          label: "Gross revenue",
          value: 0,
          valueType: "currency",
          currency: "USD",
          status: "available",
          freshness: { status: "current" },
          lineage: [],
        },
        {
          metricId: "occupancy-rate",
          metricKey: "occupancy-rate",
          label: "Occupancy",
          value: null,
          valueType: "percentage",
          status: "missing",
          freshness: { status: "unknown" },
          lineage: [],
        },
      ],
      findings: [],
      recommendations: [],
      dataGaps: [
        {
          gapId: "gap_1",
          code: "SOURCE_UNAVAILABLE",
          category: "missing",
          severity: "limiting",
          message: "Occupancy is unavailable.",
          affectedMetricKeys: ["occupancy-rate"],
        },
      ],
    },
  ],
  freshness: { status: "unknown" },
  lineage: [],
  dataGaps: [
    {
      gapId: "gap_1",
      code: "SOURCE_UNAVAILABLE",
      category: "missing",
      severity: "limiting",
      message: "Occupancy is unavailable.",
      affectedMetricKeys: ["occupancy-rate"],
    },
  ],
  generation: {
    generatorVersion: "rp001c.v1",
    deterministic: true,
    normalizedRequest: {},
  },
} as unknown as GeneratedReportSnapshot;
const options = {
  sectionKeys: ["revenue-performance"],
  includeComparison: true,
  includeFreshness: true,
  includeLineage: true,
} as const;

describe("RP-001E custom report registry", () => {
  it("has stable unique keys and returns only compatible options", () => {
    expect(
      new Set(CUSTOM_REPORT_SECTION_REGISTRY.map((item) => item.key)).size,
    ).toBe(CUSTOM_REPORT_SECTION_REGISTRY.length);
    expect(
      customReportOptions({
        scopeKind: "portfolio",
        visibility: "internal",
      }).every((item) => item.supportedScopeKinds.includes("portfolio")),
    ).toBe(true);
  });
  it("normalizes order and rejects duplicate sections", () => {
    const first = customReportOptions({
      scopeKind: "portfolio",
      visibility: "internal",
    })[0]!;
    expect(
      normalizeCustomReportConfiguration({
        title: "<b>Safe</b>",
        visibility: "internal",
        scopeKind: "portfolio",
        sections: [{ sectionKey: first.key, order: 4 }],
      }).title,
    ).toBe("Safe");
    expect(() =>
      normalizeCustomReportConfiguration({
        title: "x",
        visibility: "internal",
        scopeKind: "portfolio",
        sections: [
          { sectionKey: first.key, order: 0 },
          { sectionKey: first.key, order: 1 },
        ],
      }),
    ).toThrow(/unique/);
  });
});

describe("RP-001E renderers", () => {
  it("creates a parseable, version-bound PDF", async () => {
    const rendered = await renderCanonicalReportPdf(snapshot, options),
      pdf = await PDFDocument.load(rendered.bytes);
    expect(rendered.mediaType).toBe("application/pdf");
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    expect(pdf.getTitle()).toBe("July Performance");
  });
  it("does not add an orphan lineage page for duplicate limitations", async () => {
    const duplicated = {
        ...snapshot,
        dataGaps: Array.from({ length: 20 }, (_, index) => ({
          ...snapshot.dataGaps[0],
          gapId: `gap_${index}`,
        })),
      } as GeneratedReportSnapshot,
      rendered = await renderCanonicalReportPdf(duplicated, options),
      pdf = await PDFDocument.load(rendered.bytes);
    expect(pdf.getPageCount()).toBe(1);
  });
  it("preserves zero, leaves missing empty, and neutralizes formulas", () => {
    const rendered = renderCsvExport(snapshot, options, false),
      text = new TextDecoder().decode(rendered.bytes);
    expect(text).toContain(",0,currency");
    expect(text).toContain("occupancy-rate,Occupancy,,percentage");
    expect(csvCell(" =2+2")).toBe("' =2+2");
  });
  it("creates a traversal-safe manifest ZIP for multiple datasets", () => {
    const rendered = renderCsvExport(snapshot, options, true),
      text = new TextDecoder().decode(rendered.bytes);
    expect([...rendered.bytes.slice(0, 4)]).toEqual([80, 75, 3, 4]);
    expect(text).toContain("manifest.csv");
    expect(text).not.toContain("../");
  });
});

describe("RP-001E export lifecycle", () => {
  it("stores one validated artifact and reuses an idempotent request", async () => {
    const records = new Map<string, ReportExport>(),
      objects = new Map<string, Uint8Array>();
    const repository: ReportExportRepository = {
      reserve: async (input) => {
        const prior = [...records.values()].find(
          (item) => item.idempotencyKey === input.idempotencyKey,
        );
        if (prior) return { record: prior, replay: true };
        records.set(input.id, input);
        return { record: input, replay: false };
      },
      markGenerating: async (id) => {
        records.set(id, { ...records.get(id)!, status: "generating" });
      },
      markReady: async (id, artifact) => {
        records.set(id, { ...records.get(id)!, status: "ready", ...artifact });
      },
      markFailed: async (id, failure) => {
        records.set(id, {
          ...records.get(id)!,
          status: "failed",
          failureCode: failure.code,
          failureMessage: failure.message,
        });
      },
      get: async (id, tenant) =>
        records.get(id)?.tenantId === tenant ? records.get(id)! : null,
      list: async (version, tenant) =>
        [...records.values()].filter(
          (item) =>
            item.reportVersionId === version && item.tenantId === tenant,
        ),
      expire: async () => {},
      listExpired: async () => [],
      expireExact: async () => true,
    };
    const storage: ReportArtifactStorage = {
      store: async (input) => {
        objects.set(input.key, input.content);
      },
      createDownloadAccess: async (input) =>
        `https://example.test/${encodeURIComponent(input.fileName)}`,
      remove: async () => {},
    };
    let sequence = 0;
    const service = new ReportExportService({
        repository,
        storage,
        id: () => `id_${++sequence}`,
      clock: () => new Date("2026-08-11T00:00:00Z"),
      configuration,
      }),
      version = {
        reportId: "report_1",
        reportVersionId: "version_1",
        versionNumber: 1,
        definitionId: snapshot.definition.definitionId,
        definitionVersion: 1,
        family: "executive",
        reportType: "brief",
        title: "July Performance",
        tenantId: snapshot.scope.tenantId,
        requestedBy: snapshot.requestedBy,
        scope: snapshot.scope,
        authorizedPropertyIds: [],
        status: "ready",
        period: snapshot.period,
        snapshot,
        requestedAt: snapshot.generatedAt,
        generatedAt: snapshot.generatedAt,
      } as ReportVersion,
      actor = {
        userId: snapshot.requestedBy,
        tenantId: snapshot.scope.tenantId,
        authenticated: true,
      };
    const first = await service.request({
        actor,
        reportVersion: version,
        format: "pdf",
        idempotencyKey: "same",
      }),
      second = await service.request({
        actor,
        reportVersion: version,
        format: "pdf",
        idempotencyKey: "same",
      });
    expect(first.status).toBe("ready");
    expect(second.id).toBe(first.id);
    expect(objects.size).toBe(1);
    expect(
      await service.download({
        actor,
        exportId: first.id,
        authorizedReportVersionIds: [version.reportVersionId],
      }),
    ).toContain("july-performance");
  });
});

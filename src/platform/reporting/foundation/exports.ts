import { createHash } from "node:crypto";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type {
  GeneratedReportSnapshot,
  ReportMetric,
  ReportSection,
  ReportVersion,
} from "./model";
import { ReportFoundationError } from "./model";
import type { ReportingProductionConfiguration } from "./production-configuration";

export type ReportExportFormat = "pdf" | "csv" | "csv_zip";
export type ReportExportStatus =
  | "queued"
  | "generating"
  | "ready"
  | "failed"
  | "expired";
export type ReportExport = Readonly<{
  id: string;
  tenantId: string;
  reportId: string;
  reportVersionId: string;
  format: ReportExportFormat;
  status: ReportExportStatus;
  options: Readonly<{
    sectionKeys: readonly string[];
    includeComparison: boolean;
    includeFreshness: boolean;
    includeLineage: boolean;
  }>;
  requestedBy: string;
  requestedAt: string;
  completedAt?: string;
  expiresAt?: string;
  failureCode?: string;
  failureMessage?: string;
  correlationId: string;
  rendererVersion: string;
  idempotencyKey: string;
  storageKey?: string;
  fileName?: string;
  mediaType?: string;
  byteSize?: number;
  checksum?: string;
}>;
export interface ReportExportRepository {
  reserve(
    input: ReportExport,
  ): Promise<Readonly<{ record: ReportExport; replay: boolean }>>;
  markGenerating(id: string): Promise<void>;
  markReady(
    id: string,
    artifact: Readonly<{
      storageKey: string;
      fileName: string;
      mediaType: string;
      byteSize: number;
      checksum: string;
      completedAt: string;
      expiresAt: string;
    }>,
  ): Promise<void>;
  markFailed(
    id: string,
    failure: Readonly<{ code: string; message: string }>,
  ): Promise<void>;
  get(id: string, tenantId: string): Promise<ReportExport | null>;
  list(
    reportVersionId: string,
    tenantId: string,
  ): Promise<readonly ReportExport[]>;
  expire(id: string, tenantId: string): Promise<void>;
  listExpired(
    asOf: string,
    batchSize: number,
  ): Promise<readonly ReportExport[]>;
  expireExact(
    id: string,
    tenantId: string,
    storageKey: string,
  ): Promise<boolean>;
}
export interface ReportArtifactStorage {
  store(
    input: Readonly<{ key: string; content: Uint8Array; mediaType: string }>,
  ): Promise<void>;
  createDownloadAccess(
    input: Readonly<{
      key: string;
      fileName: string;
      expiresInSeconds: number;
    }>,
  ): Promise<string>;
  remove(key: string): Promise<void>;
}
export interface ReportExportTelemetry {
  emit(
    event: string,
    metadata: Readonly<Record<string, string | number | boolean>>,
  ): void | Promise<void>;
}
export class ReportExportService {
  constructor(
    private readonly d: Readonly<{
      repository: ReportExportRepository;
      storage: ReportArtifactStorage;
      clock?: () => Date;
      id?: () => string;
      configuration: ReportingProductionConfiguration;
      telemetry?: ReportExportTelemetry;
    }>,
  ) {}
  async request(
    input: Readonly<{
      actor: { userId: string; tenantId: string; authenticated: boolean };
      reportVersion: ReportVersion;
      format: ReportExportFormat;
      sectionKeys?: readonly string[];
      includeComparison?: boolean;
      includeFreshness?: boolean;
      includeLineage?: boolean;
      idempotencyKey: string;
      correlationId?: string;
      regeneration?: boolean;
    }>,
  ) {
    if (!this.d.configuration.reportingEnabled)
      throw new ReportFoundationError(
        "REPORT_DEFINITION_DISABLED",
        "Reporting is disabled.",
      );
    if (
      !input.actor.authenticated ||
      input.reportVersion.tenantId !== input.actor.tenantId
    )
      throw new ReportFoundationError(
        "REPORT_SCOPE_FORBIDDEN",
        "Export is unavailable.",
      );
    if (input.reportVersion.status !== "ready" || !input.reportVersion.snapshot)
      throw new ReportFoundationError(
        "REPORT_INVALID_CONFIGURATION",
        "Only ready report versions can be exported.",
      );
    const snapshot = input.reportVersion.snapshot as GeneratedReportSnapshot,
      eligible = eligibleSections(snapshot, input.format),
      selected = input.sectionKeys?.length
        ? input.sectionKeys
        : eligible.map((item) => item.sectionId);
    if (
      selected.some((key) => !eligible.some((item) => item.sectionId === key))
    )
      throw new ReportFoundationError(
        "REPORT_INVALID_CONFIGURATION",
        "An export section is unsupported.",
      );
    const now = this.now(),
      id = this.id(),
      format =
        input.format === "csv" && selected.length > 1
          ? "csv_zip"
          : input.format,
      options = Object.freeze({
        sectionKeys: Object.freeze([...new Set(selected)]),
        includeComparison: input.includeComparison !== false,
        includeFreshness: input.includeFreshness !== false,
        includeLineage: Boolean(input.includeLineage),
      }),
      record: ReportExport = {
        id,
        tenantId: input.actor.tenantId,
        reportId: input.reportVersion.reportId,
        reportVersionId: input.reportVersion.reportVersionId,
        format,
        status: "queued",
        options,
        requestedBy: input.actor.userId,
        requestedAt: now.toISOString(),
        correlationId: input.correlationId ?? this.id(),
        rendererVersion: format === "pdf" ? "rp001e.pdf.v1" : "rp001e.csv.v1",
        idempotencyKey: input.idempotencyKey,
      };
    if (
      (format === "pdf" && !this.d.configuration.pdfExportsEnabled) ||
      (format !== "pdf" && !this.d.configuration.csvExportsEnabled)
    )
      throw new ReportFoundationError(
        "REPORT_DEFINITION_DISABLED",
        "This export format is disabled.",
      );
    await this.emit("report_export_requested", record);
    if (input.regeneration)
      await this.emit("report_export_regenerated", record);
    const reserved = await this.d.repository.reserve(record);
    if (reserved.replay) return reserved.record;
    await this.d.repository.markGenerating(id);
    await this.emit("report_export_generation_started", record);
    const started = Date.now();
    let storedKey: string | undefined;
    try {
      const rendered =
          format === "pdf"
            ? await renderCanonicalReportPdf(snapshot, options)
            : renderCsvExport(snapshot, options, format === "csv_zip"),
        checksum = sha256(rendered.bytes),
        fileName = file(
          snapshot,
          input.reportVersion.versionNumber,
          format,
          now,
        ),
        storageKey = `${input.actor.tenantId}/${input.reportVersion.reportVersionId}/${id}/${fileName}`;
      this.enforce(snapshot, format, rendered, Date.now() - started);
      await this.d.storage.store({
        key: storageKey,
        content: rendered.bytes,
        mediaType: rendered.mediaType,
      });
      storedKey = storageKey;
      await this.d.repository.markReady(id, {
        storageKey,
        fileName,
        mediaType: rendered.mediaType,
        byteSize: rendered.bytes.byteLength,
        checksum,
        completedAt: now.toISOString(),
        expiresAt: new Date(
          now.getTime() + this.d.configuration.exportRetentionDays * 86400000,
        ).toISOString(),
      });
      await this.emit("report_export_completed", record, {
        durationMs: Date.now() - started,
        byteSize: rendered.bytes.byteLength,
      });
      return (await this.d.repository.get(id, input.actor.tenantId))!;
    } catch (cause) {
      if (storedKey)
        await this.d.storage.remove(storedKey).catch(() => undefined);
      await this.d.repository.markFailed(id, {
        code: exportFailureCode(cause),
        message: "The export could not be finalized safely.",
      });
      await this.emit("report_export_failed", record, {
        failureCode: exportFailureCode(cause),
      });
      throw new ReportFoundationError(
        "REPORT_GENERATION_FAILED",
        "The export could not be finalized safely.",
      );
    }
  }
  async download(
    input: Readonly<{
      actor: { userId: string; tenantId: string; authenticated: boolean };
      exportId: string;
      authorizedReportVersionIds: readonly string[];
    }>,
  ) {
    const item = await this.d.repository.get(
      input.exportId,
      input.actor.tenantId,
    );
    if (item) await this.emit("report_export_download_requested", item);
    if (
      !input.actor.authenticated ||
      !item ||
      item.status !== "ready" ||
      !item.storageKey ||
      !item.fileName ||
      !input.authorizedReportVersionIds.includes(item.reportVersionId)
    )
      throw new ReportFoundationError(
        "REPORT_SCOPE_FORBIDDEN",
        "Export download is unavailable.",
      );
    if (item.expiresAt && Date.parse(item.expiresAt) <= this.now().getTime())
      throw new ReportFoundationError(
        "REPORT_INVALID_CONFIGURATION",
        "The export artifact expired.",
      );
    const access = await this.d.storage.createDownloadAccess({
      key: item.storageKey,
      fileName: item.fileName,
      expiresInSeconds: this.d.configuration.exportDownloadTtlSeconds,
    });
    await this.emit("report_export_download_completed", item);
    return access;
  }
  private enforce(
    snapshot: GeneratedReportSnapshot,
    format: ReportExportFormat,
    rendered: { bytes: Uint8Array; pageCount?: number },
    durationMs: number,
  ) {
    const c = this.d.configuration;
    if (durationMs > c.maximumExportDurationMs)
      throw exportLimit("REPORT_EXPORT_DURATION_LIMIT");
    if (
      format === "pdf" &&
      ((rendered.pageCount ?? 0) > c.maximumPdfPages ||
        rendered.bytes.byteLength > c.maximumPdfArtifactBytes)
    )
      throw exportLimit("REPORT_PDF_LIMIT");
    const sections = snapshot.sections,
      values = sections.flatMap((section) => [
        section.title,
        ...section.metrics.map((metric) => metric.label),
        ...section.dataGaps.map((gap) => gap.message),
        ...(section.tables ?? []).flatMap((table) =>
          table.rows.flatMap((row) => Object.values(row).map(String)),
        ),
      ]);
    const rows = sections.reduce(
        (sum, section) =>
          sum +
          section.metrics.length +
          (section.tables ?? []).reduce(
            (n, table) => n + table.rows.length,
            0,
          ) +
          section.dataGaps.length,
        0,
      ),
      columns = Math.max(
        0,
        ...sections.flatMap((section) =>
          (section.tables ?? []).map((table) => table.columns.length),
        ),
      ),
      entries =
        sections.reduce(
          (sum, section) =>
            sum +
            (section.metrics.length ? 1 : 0) +
            (section.tables?.length ?? 0) +
            (section.dataGaps.length ? 1 : 0),
          0,
        ) + 1;
    if (
      format !== "pdf" &&
      (rows > c.maximumCsvRows ||
        columns > c.maximumCsvColumns ||
        values.some((value) => value.length > c.maximumCsvCellCharacters))
    )
      throw exportLimit("REPORT_CSV_LIMIT");
    if (
      format === "csv" &&
      rendered.bytes.byteLength > c.maximumCsvArtifactBytes
    )
      throw exportLimit("REPORT_CSV_LIMIT");
    if (
      format === "csv_zip" &&
      (entries > c.maximumZipEntries ||
        rendered.bytes.byteLength > c.maximumZipArtifactBytes)
    )
      throw exportLimit("REPORT_ZIP_LIMIT");
  }
  private async emit(
    event: string,
    item: Pick<
      ReportExport,
      "correlationId" | "id" | "format" | "rendererVersion"
    >,
    extra: Readonly<Record<string, string | number | boolean>> = {},
  ) {
    try {
      await this.d.telemetry?.emit(event, {
        correlationId: item.correlationId,
        exportId: item.id,
        format: item.format,
        rendererVersion: item.rendererVersion,
        ...extra,
      });
    } catch {
      /* non-authoritative */
    }
  }
  private now() {
    return (this.d.clock ?? (() => new Date()))();
  }
  private id() {
    return (this.d.id ?? (() => crypto.randomUUID()))();
  }
}

export class ExpireReportArtifacts {
  constructor(
    private readonly d: Readonly<{
      repository: ReportExportRepository;
      storage: ReportArtifactStorage;
      telemetry?: ReportExportTelemetry;
    }>,
  ) {}
  async execute(
    input: Readonly<{ asOf: Date; batchSize: number; correlationId: string }>,
  ) {
    const targets = await this.d.repository.listExpired(
      input.asOf.toISOString(),
      Math.max(1, Math.min(input.batchSize, 100)),
    );
    let expired = 0,
      failed = 0;
    for (const target of targets) {
      if (
        !target.storageKey ||
        !target.expiresAt ||
        Date.parse(target.expiresAt) > input.asOf.getTime()
      )
        continue;
      try {
        await this.d.storage.remove(target.storageKey);
        if (
          await this.d.repository.expireExact(
            target.id,
            target.tenantId,
            target.storageKey,
          )
        ) {
          expired++;
          await safeEmit(this.d.telemetry, "report_export_expired", {
            correlationId: input.correlationId,
            exportId: target.id,
            format: target.format,
          });
        }
      } catch {
        failed++;
        await safeEmit(this.d.telemetry, "report_export_cleanup_failed", {
          correlationId: input.correlationId,
          exportId: target.id,
          format: target.format,
          failureCode: "REPORT_EXPORT_CLEANUP_FAILED",
        });
      }
    }
    await safeEmit(this.d.telemetry, "report_export_cleanup_completed", {
      correlationId: input.correlationId,
      count: expired,
      failedCount: failed,
    });
    return Object.freeze({ expired, failed });
  }
}

export async function renderCanonicalReportPdf(
  snapshot: GeneratedReportSnapshot,
  options: ReportExport["options"],
) {
  const doc = await PDFDocument.create();
  doc.setTitle(snapshot.report.title);
  doc.setAuthor("Luxe Haven Collective");
  doc.setLanguage("en-US");
  doc.setProducer("Luxe Haven Reporting rp001e.pdf.v1");
  const regular = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold),
    serif = await doc.embedFont(StandardFonts.TimesRomanBold),
    layout = new PdfLayout(doc, regular, bold, serif, snapshot);
  layout.cover();
  for (const section of snapshot.sections.filter((item) =>
    options.sectionKeys.includes(item.sectionId),
  ))
    layout.section(section);
  layout.limitations();
  if (options.includeLineage) layout.lineage();
  layout.finish();
  const bytes = await doc.save({
    useObjectStreams: false,
    addDefaultPage: false,
  });
  if (
    bytes.byteLength < 8 ||
    new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
  )
    throw new Error("invalid_pdf");
  return { bytes, mediaType: "application/pdf", pageCount: doc.getPageCount() };
}
class PdfLayout {
  private page!: PDFPage;
  private y = 0;
  private pages: PDFPage[] = [];
  constructor(
    private doc: PDFDocument,
    private regular: PDFFont,
    private bold: PDFFont,
    private serif: PDFFont,
    private snapshot: GeneratedReportSnapshot,
  ) {}
  cover() {
    this.add();
    this.text("LUXE HAVEN COLLECTIVE", 11, this.bold, rgb(0.45, 0.32, 0.12));
    this.y -= 30;
    this.text(this.snapshot.report.title, 30, this.serif);
    this.y -= 15;
    this.text(this.snapshot.definition.title, 12, this.bold);
    this.text(
      `${this.snapshot.period.startDate} – ${this.snapshot.period.endDate} · ${this.snapshot.period.timezone}`,
      10,
      this.regular,
    );
    this.text(
      `Report version ${this.snapshot.report.versionNumber} · Generated ${this.snapshot.generatedAt}`,
      9,
      this.regular,
    );
    this.text(
      `Data freshness: ${this.snapshot.freshness.status}`,
      9,
      this.bold,
    );
  }
  section(section: ReportSection) {
    this.ensure(80);
    this.text(section.title, 20, this.serif);
    for (const metric of section.metrics) {
      this.ensure(34);
      this.text(`${metric.label}: ${pdfMetric(metric)}`, 10, this.bold);
      if (metric.comparison?.status === "available")
        this.text(
          `Comparison ${metric.comparison.value ?? "Unavailable"}; change ${metric.comparison.absoluteChange ?? "Unavailable"}`,
          8,
          this.regular,
        );
    }
    for (const finding of section.findings) {
      this.text(`Finding — ${finding.title}`, 10, this.bold);
      this.text(finding.summary, 9, this.regular);
    }
    for (const recommendation of section.recommendations) {
      this.text(`Recommendation — ${recommendation.title}`, 10, this.bold);
      this.text(recommendation.rationale, 9, this.regular);
    }
    for (const gap of section.dataGaps)
      this.text(`Limitation: ${gap.message}`, 8, this.regular);
  }
  limitations() {
    this.ensure(60);
    this.text("Data Quality and Limitations", 18, this.serif);
    if (!this.snapshot.dataGaps.length)
      this.text("No disclosed data gaps.", 9, this.regular);
    for (const gap of this.snapshot.dataGaps)
      this.text(
        `${gap.severity.toUpperCase()}: ${gap.message}`,
        9,
        this.regular,
      );
  }
  lineage() {
    this.ensure(60);
    this.text("Source Lineage", 18, this.serif);
    for (const item of this.snapshot.lineage.slice(0, 100))
      this.text(
        `${item.sourceType}${item.sourceVersionId ? ` · ${item.sourceVersionId}` : ""}`,
        8,
        this.regular,
      );
  }
  finish() {
    this.pages.forEach((page, index) => {
      page.drawText(
        `Generated from immutable report version ${this.snapshot.report.versionNumber} · Page ${index + 1} of ${this.pages.length}`,
        {
          x: 44,
          y: 24,
          font: this.regular,
          size: 7,
          color: rgb(0.35, 0.33, 0.3),
        },
      );
    });
  }
  private add() {
    this.page = this.doc.addPage([612, 792]);
    this.pages.push(this.page);
    this.y = 744;
  }
  private ensure(height: number) {
    if (!this.page || this.y - height < 48) this.add();
  }
  private text(
    value: string,
    size: number,
    font: PDFFont,
    color = rgb(0.12, 0.1, 0.09),
  ) {
    const lines = wrap(safePdf(value), font, size, 524);
    this.ensure(lines.length * size * 1.35 + 8);
    for (const line of lines) {
      this.page.drawText(line, { x: 44, y: this.y, font, size, color });
      this.y -= size * 1.35;
    }
    this.y -= 7;
  }
}

export const CSV_SCHEMAS = Object.freeze({
  metrics: Object.freeze({
    version: 1,
    columns: [
      "section_key",
      "metric_key",
      "metric_label",
      "value",
      "value_type",
      "unit",
      "currency",
      "availability",
      "comparison_value",
      "absolute_change",
      "percentage_change",
      "freshness",
      "period_start",
      "period_end",
      "timezone",
    ],
  }),
  tables: Object.freeze({
    version: 1,
    columns: [
      "section_key",
      "table_key",
      "row_number",
      "field_key",
      "value",
      "availability",
    ],
  }),
  data_gaps: Object.freeze({
    version: 1,
    columns: [
      "section_key",
      "gap_code",
      "category",
      "severity",
      "message",
      "affected_metric_keys",
    ],
  }),
});
export function renderCsvExport(
  snapshot: GeneratedReportSnapshot,
  options: ReportExport["options"],
  zip: boolean,
) {
  const selected = snapshot.sections.filter((item) =>
      options.sectionKeys.includes(item.sectionId),
    ),
    datasets = new Map<string, string>();
  for (const section of selected) {
    if (section.metrics.length)
      datasets.set(
        `${section.sectionId}-metrics.csv`,
        csv(
          CSV_SCHEMAS.metrics.columns,
          section.metrics.map((metric) =>
            metricRow(snapshot, section, metric, options),
          ),
        ),
      );
    for (const table of section.tables ?? [])
      datasets.set(
        `${section.sectionId}-${table.tableId}.csv`,
        csv(
          [
            "section_key",
            "table_key",
            "row_number",
            ...table.columns.map((column) => column.key),
          ],
          table.rows.map((row, index) => [
            section.sectionId,
            table.tableId,
            index + 1,
            ...table.columns.map((column) => cell(row[column.key])),
          ]),
        ),
      );
    if (section.dataGaps.length)
      datasets.set(
        `${section.sectionId}-data-gaps.csv`,
        csv(
          CSV_SCHEMAS.data_gaps.columns,
          section.dataGaps.map((gap) => [
            section.sectionId,
            gap.code,
            gap.category,
            gap.severity,
            gap.message,
            gap.affectedMetricKeys.join("|"),
          ]),
        ),
      );
  }
  if (!datasets.size) throw new Error("no_csv_data");
  if (!zip && datasets.size === 1)
    return {
      bytes: new TextEncoder().encode([...datasets.values()][0]!),
      mediaType: "text/csv;charset=utf-8",
    };
  const manifest = csv(
    [
      "report_version",
      "definition_id",
      "exported_at",
      "dataset_file",
      "schema_version",
      "row_count",
    ],
    [...datasets].map(([name, value]) => [
      snapshot.report.versionNumber,
      snapshot.definition.definitionId,
      snapshot.generatedAt,
      name,
      1,
      Math.max(0, value.split("\n").length - 2),
    ]),
  );
  datasets.set("manifest.csv", manifest);
  return { bytes: storedZip(datasets), mediaType: "application/zip" };
}
function metricRow(
  snapshot: GeneratedReportSnapshot,
  section: ReportSection,
  metric: ReportMetric,
  options: ReportExport["options"],
) {
  return [
    section.sectionId,
    metric.metricKey,
    metric.label,
    metric.status === "available" ? metric.value : "",
    metric.valueType,
    metric.unit ?? "",
    metric.currency ?? "",
    metric.status,
    options.includeComparison ? (metric.comparison?.value ?? "") : "",
    options.includeComparison ? (metric.comparison?.absoluteChange ?? "") : "",
    options.includeComparison
      ? (metric.comparison?.percentageChange ?? "")
      : "",
    options.includeFreshness ? (metric.freshness?.status ?? "unknown") : "",
    snapshot.period.startDate,
    snapshot.period.endDate,
    snapshot.period.timezone,
  ];
}
function csv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
) {
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
export function csvCell(value: unknown) {
  let text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .slice(0, 10000);
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function storedZip(files: ReadonlyMap<string, string>) {
  const entries = [...files].map(([name, value]) => ({
      name: name.replace(/[^a-z0-9._-]/gi, "-"),
      data: new TextEncoder().encode(value),
    })),
    locals: Uint8Array[] = [],
    centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name),
      crc = crc32(entry.data),
      local = concat(
        u32(0x04034b50),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(entry.data.length),
        u32(entry.data.length),
        u16(name.length),
        u16(0),
        name,
        entry.data,
      );
    locals.push(local);
    centrals.push(
      concat(
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(entry.data.length),
        u32(entry.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ),
    );
    offset += local.length;
  }
  const central = concat(...centrals);
  return concat(
    ...locals,
    central,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(offset),
    u16(0),
  );
}
function u16(n: number) {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}
function u32(n: number) {
  return new Uint8Array([
    n & 255,
    (n >>> 8) & 255,
    (n >>> 16) & 255,
    (n >>> 24) & 255,
  ]);
}
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function eligibleSections(
  snapshot: GeneratedReportSnapshot,
  format: ReportExportFormat,
) {
  return snapshot.sections.filter(
    (section) =>
      format === "pdf" ||
      section.metrics.length ||
      section.tables?.length ||
      section.dataGaps.length,
  );
}
function file(
  snapshot: GeneratedReportSnapshot,
  version: number,
  format: ReportExportFormat,
  date: Date,
) {
  const slug =
    snapshot.report.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "report";
  return `luxe-haven-${slug}-v${version}-${date.toISOString().slice(0, 10)}.${format === "csv_zip" ? "zip" : format}`;
}
function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
function safePdf(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7e]/g, "-");
}
function wrap(value: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  let line = "";
  for (const word of value.split(/\s+/)) {
    const candidate = `${line} ${word}`.trim();
    if (line && font.widthOfTextAtSize(candidate, size) > width) {
      out.push(line);
      line = word;
    } else line = candidate;
  }
  out.push(line || " ");
  return out;
}
function pdfMetric(metric: ReportMetric) {
  if (metric.status !== "available") return metric.status;
  if (metric.valueType === "percentage" && typeof metric.value === "number")
    return `${(metric.value * 100).toFixed(1)}%`;
  if (metric.valueType === "currency" && typeof metric.value === "number")
    return `${metric.currency ?? "USD"} ${metric.value.toFixed(2)}`;
  return String(metric.value);
}
function exportLimit(code: string) {
  return new ReportFoundationError("REPORT_GENERATION_FAILED", code);
}
function exportFailureCode(cause: unknown) {
  return cause instanceof ReportFoundationError &&
    /^REPORT_[A-Z_]+$/.test(cause.message)
    ? cause.message
    : cause instanceof ReportFoundationError
      ? cause.code
      : "REPORT_EXPORT_FAILED";
}
async function safeEmit(
  telemetry: ReportExportTelemetry | undefined,
  event: string,
  metadata: Readonly<Record<string, string | number | boolean>>,
) {
  try {
    await telemetry?.emit(event, metadata);
  } catch {
    /* non-authoritative */
  }
}
function cell(value: unknown) {
  return value === null || value === undefined
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : value;
}

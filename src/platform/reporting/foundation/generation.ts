import { createHash } from "node:crypto";
import type {
  StandardReportCatalogEntry,
  CatalogSectionDefinition,
} from "./catalog";
import {
  REPORT_METRIC_SOURCE_MATRIX,
  standardReportCatalog,
  validateCustomCatalogSelection,
} from "./catalog";
import type {
  GenerateReportRequest,
  ReportActor,
  ReportAuthorization,
  ReportRepository,
} from "./application";
import { validateGenerateReportRequest } from "./application";
import type {
  ComparisonPeriod,
  DataFreshness,
  GeneratedReportSnapshot,
  Report,
  ReportDataGap,
  ReportMetric,
  ReportMetricComparison,
  ReportScope,
  ReportSection,
  ReportVersion,
  SourceLineage,
} from "./model";
import { assertSnapshot, ReportFoundationError } from "./model";
import {
  normalizeCustomReportConfiguration,
  type CustomReportConfiguration,
} from "./custom-reports";

export type ReportSourceValue<T> = Readonly<
  | {
      status: "available";
      value: T;
      freshness: DataFreshness;
      lineage: readonly SourceLineage[];
    }
  | {
      status: "missing" | "stale" | "unsupported";
      value?: T;
      freshness: DataFreshness;
      lineage: readonly SourceLineage[];
      reasonCode: string;
    }
>;
export type ReportSourceData = Readonly<{
  metrics: Readonly<
    Record<string, ReportSourceValue<number | string | boolean>>
  >;
  comparisonMetrics?: Readonly<
    Record<string, ReportSourceValue<number | string | boolean>>
  >;
  findings?: readonly Readonly<{
    id: string;
    category: string;
    severity: "informational" | "positive" | "attention" | "critical";
    title: string;
    summary: string;
    metricKeys: readonly string[];
    lineage: readonly SourceLineage[];
    visibility?: "standard" | "internal" | "owner_safe";
  }>[];
  recommendations?: readonly Readonly<{
    id: string;
    category: string;
    priority: "low" | "medium" | "high" | "critical";
    title: string;
    rationale: string;
    findingIds: readonly string[];
  }>[];
  tables?: Readonly<
    Record<
      string,
      readonly Readonly<Record<string, number | string | boolean | null>>[]
    >
  >;
  dataGaps?: readonly ReportDataGap[];
}>;
export type AuthorizedGenerationInput = Readonly<{
  tenantId: string;
  requesterId: string;
  definition: StandardReportCatalogEntry;
  scope: ReportScope;
  period: GenerateReportRequest["period"];
  comparisonPeriod?: ComparisonPeriod;
  propertyIds: readonly string[];
  correlationId: string;
}>;
export interface ReportDataProvider {
  load(input: AuthorizedGenerationInput): Promise<ReportSourceData>;
}
export interface ReportProviderRegistry {
  get(family: StandardReportCatalogEntry["family"]): ReportDataProvider;
}
export interface ReportGenerationRepository extends ReportRepository {
  reserveGeneration(
    input: Readonly<{
      report?: Report;
      reportId: string;
      versionId: string;
      definition: StandardReportCatalogEntry;
      actor: ReportActor;
      scope: ReportScope;
      propertyIds: readonly string[];
      period: GenerateReportRequest["period"];
      comparisonPeriod?: ComparisonPeriod;
      title: string;
      requestedAt: string;
      idempotencyKey?: string;
      requestFingerprint: string;
    }>,
  ): Promise<Readonly<{ version: ReportVersion; replay: boolean }>>;
}
export interface ReportTelemetry {
  emit(
    event: string,
    metadata: Readonly<Record<string, string | number | boolean>>,
  ): void | Promise<void>;
}

export type GenerateReportResult = Readonly<{
  reportId: string;
  versionId: string;
  versionNumber: number;
  status: "ready";
  generatedAt: string;
}>;

export class ReportGenerator {
  constructor(
    private readonly dependencies: Readonly<{
      repository: ReportGenerationRepository;
      authorization: ReportAuthorization;
      providers: ReportProviderRegistry;
      telemetry?: ReportTelemetry;
      clock?: () => string;
      id?: () => string;
      generatorVersion?: string;
    }>,
  ) {}

  async execute(
    request: GenerateReportRequest,
    actor: ReportActor,
    options: Readonly<{ reportId?: string; correlationId?: string }> = {},
  ): Promise<GenerateReportResult> {
    const correlationId = options.correlationId ?? this.id();
    const terminal = { emitted: false };
    let reserved: ReportVersion | undefined;
    try {
      await this.telemetry("report_generation_requested", {
        correlationId,
        definitionId: request.definitionId,
      });
      const validated = await validateGenerateReportRequest(
        request,
        actor,
        this.dependencies.authorization,
      );
      const catalog = standardReportCatalog.get(
        validated.definition.definitionId,
        validated.definition.version,
      );
      const normalizedCustom = this.validateCustom(
        catalog,
        request,
        validated.scope,
      );
      const reportId = options.reportId ?? this.id(),
        versionId = this.id(),
        requestedAt = this.now();
      const fingerprint = fingerprintRequest({
        definitionId: catalog.definitionId,
        definitionVersion: catalog.definitionVersion,
        scope: validated.scope,
        period: validated.period,
        comparisonPeriod: validated.comparisonPeriod ?? null,
        customConfiguration: normalizedCustom ?? null,
        title: validated.title ?? null,
      });
      const report: Report | undefined = options.reportId
        ? undefined
        : Object.freeze({
            reportId,
            tenantId: actor.tenantId,
            family: catalog.family,
            reportType: catalog.reportType,
            definitionId: catalog.definitionId,
            createdBy: actor.userId,
            createdAt: requestedAt,
          });
      const reservation = await this.dependencies.repository.reserveGeneration({
        report,
        reportId,
        versionId,
        definition: catalog,
        actor,
        scope: validated.scope,
        propertyIds: validated.authorizedPropertyIds,
        period: validated.period,
        ...(validated.comparisonPeriod
          ? { comparisonPeriod: validated.comparisonPeriod }
          : {}),
        title: validated.title ?? catalog.title,
        requestedAt,
        ...(request.idempotencyKey
          ? { idempotencyKey: request.idempotencyKey }
          : {}),
        requestFingerprint: fingerprint,
      });
      reserved = reservation.version;
      if (reservation.replay) {
        this.assertReplayAuthorized(reserved, actor);
        if (reserved.status !== "ready" || !reserved.generatedAt)
          throw new ReportFoundationError(
            "REPORT_CONCURRENT_MODIFICATION",
            "The idempotent generation is not ready.",
          );
        return resultOf(reserved);
      }
      await this.dependencies.repository.markGenerating(
        reserved.reportVersionId,
      );
      await this.telemetry(
        "report_generation_started",
        safeMetadata(correlationId, reserved, catalog),
      );
      const provider = this.dependencies.providers.get(catalog.family);
      const source = await provider.load({
        tenantId: actor.tenantId,
        requesterId: actor.userId,
        definition: catalog,
        scope: validated.scope,
        period: validated.period,
        ...(validated.comparisonPeriod
          ? { comparisonPeriod: validated.comparisonPeriod }
          : {}),
        propertyIds: validated.authorizedPropertyIds,
        correlationId,
      });
      const generatedAt = this.now();
      const snapshot = assembleSnapshot({
        catalog,
        source,
        reportId: reserved.reportId,
        version: reserved,
        scope: validated.scope,
        period: validated.period,
        comparisonPeriod: validated.comparisonPeriod,
        requestedBy: actor.userId,
        generatedAt,
        normalizedRequest: {
          scope: validated.scope,
          period: validated.period,
          comparisonPeriod: validated.comparisonPeriod ?? null,
          sourceContext: validated.sourceContext,
          customConfiguration: normalizedCustom ?? null,
        },
        generatorVersion: this.dependencies.generatorVersion ?? "rp001c.v1",
        customConfiguration: normalizedCustom,
      });
      validateGeneratedSnapshot(snapshot, catalog);
      await this.dependencies.repository.markReady(
        reserved.reportVersionId,
        snapshot,
      );
      terminal.emitted = true;
      await this.telemetry("report_generation_completed", {
        ...safeMetadata(correlationId, reserved, catalog),
        sectionCount: snapshot.sections.length,
        gapCount: snapshot.dataGaps.length,
      });
      return {
        reportId: reserved.reportId,
        versionId: reserved.reportVersionId,
        versionNumber: reserved.versionNumber,
        status: "ready",
        generatedAt,
      };
    } catch (cause) {
      const failure = safeFailure(cause);
      if (
        reserved &&
        reserved.status !== "ready" &&
        reserved.status !== "failed"
      )
        await this.dependencies.repository
          .markFailed(reserved.reportVersionId, failure)
          .catch(() => undefined);
      if (!terminal.emitted)
        await this.telemetry("report_generation_failed", {
          correlationId,
          failureCode: failure.code,
        }).catch(() => undefined);
      throw cause instanceof ReportFoundationError
        ? cause
        : new ReportFoundationError(failure.code, failure.message);
    }
  }

  async regenerate(
    reportId: string,
    request: GenerateReportRequest,
    actor: ReportActor,
    correlationId?: string,
  ) {
    const report = await this.dependencies.repository.getReport(
      reportId,
      actor,
    );
    if (!report)
      throw new ReportFoundationError(
        "REPORT_VERSION_NOT_FOUND",
        "Report was not found.",
      );
    if (report.tenantId !== actor.tenantId)
      throw new ReportFoundationError(
        "REPORT_SCOPE_FORBIDDEN",
        "Report scope is forbidden.",
      );
    if (report.definitionId !== request.definitionId)
      throw new ReportFoundationError(
        "REPORT_INVALID_CONFIGURATION",
        "Regeneration must use the logical report definition.",
      );
    await this.telemetry("report_regeneration_requested", {
      correlationId: correlationId ?? "generated",
      reportId,
    });
    return this.execute(request, actor, {
      reportId,
      ...(correlationId ? { correlationId } : {}),
    });
  }

  private validateCustom(
    catalog: StandardReportCatalogEntry,
    request: GenerateReportRequest,
    scope: ReportScope,
  ) {
    if (catalog.family !== "custom") return undefined;
    const modern = request.customConfiguration as
      | CustomReportConfiguration
      | undefined;
    if (modern?.schemaVersion === 1)
      return normalizeCustomReportConfiguration({
        title: modern.title,
        introductoryNote: modern.introductoryNote,
        visibility: modern.visibility,
        scopeKind: scope.kind,
        sections: modern.sections,
        presentation: modern.presentation,
      });
    const configuration = request.customConfiguration as
      | {
          sectionKeys?: readonly string[];
          metricKeysBySection?: Readonly<Record<string, readonly string[]>>;
          visibility?: "standard" | "internal" | "owner_safe";
        }
      | undefined;
    if (!configuration?.sectionKeys)
      throw new ReportFoundationError(
        "REPORT_INVALID_CONFIGURATION",
        "Custom reports require approved sections.",
      );
    return validateCustomCatalogSelection({
      scope: scope.kind,
      sectionKeys: configuration.sectionKeys,
      metricKeysBySection: configuration.metricKeysBySection,
      visibility: configuration.visibility ?? "internal",
    });
  }
  private assertReplayAuthorized(version: ReportVersion, actor: ReportActor) {
    if (!actor.authenticated || version.tenantId !== actor.tenantId)
      throw new ReportFoundationError(
        "REPORT_SCOPE_FORBIDDEN",
        "Report scope is forbidden.",
      );
  }
  private now() {
    return (this.dependencies.clock ?? (() => new Date().toISOString()))();
  }
  private id() {
    return (this.dependencies.id ?? (() => crypto.randomUUID()))();
  }
  private async telemetry(
    event: string,
    metadata: Readonly<Record<string, string | number | boolean>>,
  ) {
    try {
      await this.dependencies.telemetry?.emit(event, metadata);
    } catch {
      /* telemetry is non-authoritative */
    }
  }
}

function assembleSnapshot(
  input: Readonly<{
    catalog: StandardReportCatalogEntry;
    source: ReportSourceData;
    reportId: string;
    version: ReportVersion;
    scope: ReportScope;
    period: GenerateReportRequest["period"];
    comparisonPeriod?: ComparisonPeriod;
    requestedBy: string;
    generatedAt: string;
    normalizedRequest: Readonly<Record<string, unknown>>;
    generatorVersion: string;
    customConfiguration?: readonly string[] | CustomReportConfiguration;
  }>,
): GeneratedReportSnapshot {
  const sections = selectedSections(
    input.catalog,
    input.customConfiguration,
  ).map((section, order) =>
    assembleSection(
      section,
      input.source,
      input.comparisonPeriod,
      input.catalog.family === "custom" ? order : section.order,
    ),
  );
  const gaps = dedupeGaps([
    ...(input.source.dataGaps ?? []),
    ...sections.flatMap((section) => section.dataGaps),
  ]);
  const lineage = dedupeLineage(
    sections.flatMap((section) => [
      ...section.metrics.flatMap((metric) => metric.lineage),
      ...section.findings.flatMap((finding) => finding.lineage),
      ...(section.tables ?? []).flatMap((table) => table.lineage),
    ]),
  );
  return Object.freeze({
    schemaVersion: "rp001.report-snapshot.v1",
    definition: {
      definitionId: input.catalog.definitionId,
      definitionVersion: input.catalog.definitionVersion,
      family: input.catalog.family,
      reportType: input.catalog.reportType,
      title: input.catalog.title,
    },
    report: {
      reportId: input.reportId,
      versionId: input.version.reportVersionId,
      versionNumber: input.version.versionNumber,
      title: input.version.title,
    },
    scope: input.scope,
    period: input.period,
    ...(input.comparisonPeriod
      ? { comparisonPeriod: input.comparisonPeriod }
      : {}),
    generatedAt: input.generatedAt,
    requestedBy: input.requestedBy,
    sections: Object.freeze(sections),
    freshness: aggregateFreshness(
      sections.flatMap((section) =>
        section.metrics
          .map((metric) => metric.freshness)
          .filter((value): value is DataFreshness => Boolean(value)),
      ),
    ),
    lineage,
    dataGaps: gaps,
    generation: {
      generatorVersion: input.generatorVersion,
      deterministic: true as const,
      normalizedRequest: input.normalizedRequest,
    },
  });
}

function selectedSections(
  catalog: StandardReportCatalogEntry,
  custom?: readonly string[] | CustomReportConfiguration,
): readonly CatalogSectionDefinition[] {
  if (catalog.family !== "custom") return catalog.sectionDefinitions;
  const library = new Map(
    standardReportCatalog.definitions
      .filter((item) => item.family !== "custom")
      .flatMap((item) => item.sectionDefinitions)
      .map((section) => [section.key, section]),
  );
  const selections: readonly Readonly<{
    sectionKey: string;
    metricKeys?: readonly string[];
  }>[] = Array.isArray(custom)
    ? custom.map((sectionKey) => ({ sectionKey, metricKeys: undefined }))
    : ((custom as CustomReportConfiguration | undefined)?.sections ?? []);
  return Object.freeze(
    selections
      .map((selection) => {
        const section = library.get(selection.sectionKey);
        return section
          ? Object.freeze({
              ...section,
              metricKeys: selection.metricKeys ?? section.metricKeys,
            })
          : undefined;
      })
      .filter((section): section is CatalogSectionDefinition =>
        Boolean(section),
      ),
  );
}
function assembleSection(
  section: CatalogSectionDefinition,
  source: ReportSourceData,
  comparisonPeriod?: ComparisonPeriod,
  order = section.order,
): ReportSection {
  const metrics = section.metricKeys.map((key) =>
    assembleMetric(
      key,
      source.metrics[key],
      source.comparisonMetrics?.[key],
      comparisonPeriod,
    ),
  );
  const gaps = metrics
    .filter((metric) => metric.status !== "available")
    .map(
      (metric, index): ReportDataGap =>
        Object.freeze({
          gapId: `${section.key}:${metric.metricKey}:${index}`,
          code:
            metric.status === "stale" ? "SOURCE_STALE" : "SOURCE_UNAVAILABLE",
          category: metric.status === "stale" ? "stale" : "missing",
          severity: "limiting",
          message: `${metric.label} is ${metric.status}.`,
          affectedMetricKeys: [metric.metricKey],
        }),
    );
  const metricSet = new Set(section.metricKeys);
  const candidates = (source.findings ?? []).filter(
    (item) => item.category === section.key,
  );
  if (
    section.visibility === "owner_safe" &&
    candidates.some((item) => item.visibility !== "owner_safe")
  )
    throw new ReportFoundationError(
      "REPORT_DISCLOSURE_VIOLATION",
      "Owner report source content is not owner-safe.",
    );
  const findings = candidates
    .filter((item) => item.metricKeys.every((key) => metricSet.has(key)))
    .map((item) =>
      Object.freeze({
        findingId: item.id,
        category: item.category,
        severity: item.severity,
        title: plain(item.title),
        summary: plain(item.summary),
        basis: "deterministic" as const,
        supportingMetricKeys: item.metricKeys,
        lineage: item.lineage,
      }),
    );
  const findingSet = new Set(findings.map((item) => item.findingId));
  const recommendations = (source.recommendations ?? [])
    .filter(
      (item) =>
        item.category === section.key &&
        item.findingIds.every((id) => findingSet.has(id)),
    )
    .map((item) =>
      Object.freeze({
        recommendationId: item.id,
        category: item.category,
        priority: item.priority,
        title: plain(item.title),
        rationale: plain(item.rationale),
        basis: "deterministic" as const,
        supportingFindingIds: item.findingIds,
      }),
    );
  const tables = section.tableKeys.flatMap((key) =>
    source.tables?.[key]
      ? [
          {
            tableId: key,
            columns: inferColumns(source.tables[key]!),
            rows: source.tables[key]!.slice(0, 1000),
            lineage: [],
          },
        ]
      : [],
  );
  const available = metrics.filter(
    (metric) => metric.status === "available",
  ).length;
  return Object.freeze({
    sectionId: section.key,
    sectionType: section.sectionType,
    title: section.title,
    order,
    visibility: section.visibility,
    status: gaps.length ? (available ? "partial" : "unavailable") : "available",
    metrics: Object.freeze(metrics),
    findings: Object.freeze(findings),
    recommendations: Object.freeze(recommendations),
    ...(tables.length ? { tables: Object.freeze(tables) } : {}),
    dataGaps: Object.freeze(gaps),
  });
}
function assembleMetric(
  key: string,
  current: ReportSourceValue<number | string | boolean> | undefined,
  comparison: ReportSourceValue<number | string | boolean> | undefined,
  period?: ComparisonPeriod,
): ReportMetric {
  const registration = REPORT_METRIC_SOURCE_MATRIX.find(
    (item) => item.metricKey === key,
  );
  if (!registration)
    throw new ReportFoundationError(
      "REPORT_SNAPSHOT_INVALID",
      "A report metric is not registered.",
    );
  const available = current?.status === "available";
  const value = available ? current.value : null;
  const valueType = metricValueType(key);
  return Object.freeze({
    metricId: key,
    metricKey: key,
    label: registration.displayLabel,
    value,
    valueType,
    ...(valueType === "currency" ? { currency: "USD" } : {}),
    ...(period ? { comparison: compare(value, comparison, period) } : {}),
    status: available
      ? "available"
      : current?.status === "stale"
        ? "stale"
        : "missing",
    freshness: current?.freshness ?? { status: "unknown" as const },
    lineage: current?.lineage ?? [],
  });
}
export function compare(
  current: number | string | boolean | null,
  prior: ReportSourceValue<number | string | boolean> | undefined,
  period: ComparisonPeriod,
): ReportMetricComparison {
  if (!prior || prior.status !== "available")
    return { requested: true, status: "unavailable", period };
  if (typeof current !== "number" || typeof prior.value !== "number")
    return {
      requested: true,
      status: "not_calculable",
      value: prior.value,
      period,
    };
  const absoluteChange = current - prior.value;
  return {
    requested: true,
    status: prior.value === 0 ? "not_calculable" : "available",
    value: prior.value,
    absoluteChange,
    ...(prior.value !== 0
      ? { percentageChange: absoluteChange / Math.abs(prior.value) }
      : {}),
    direction:
      absoluteChange === 0
        ? "unchanged"
        : absoluteChange > 0
          ? "increase"
          : "decrease",
    period,
  };
}
export function validateGeneratedSnapshot(
  snapshot: GeneratedReportSnapshot,
  catalog: StandardReportCatalogEntry,
) {
  assertSnapshot(
    snapshot,
    new Set(REPORT_METRIC_SOURCE_MATRIX.map((item) => item.metricKey)),
  );
  const custom = catalog.family === "custom",
    expected = selectedSections(
      catalog,
      custom ? snapshot.sections.map((item) => item.sectionId) : undefined,
    );
  if (
    snapshot.sections.length !== expected.length ||
    snapshot.sections.some(
      (section, index) =>
        section.sectionId !== expected[index]?.key ||
        section.order !== (custom ? index : expected[index]?.order),
    )
  )
    throw new ReportFoundationError(
      "REPORT_SNAPSHOT_INVALID",
      "Report sections do not match the catalog.",
    );
  if (
    catalog.visibilityPolicy.default === "owner_safe" &&
    snapshot.sections.some((section) => section.visibility !== "owner_safe")
  )
    throw new ReportFoundationError(
      "REPORT_DISCLOSURE_VIOLATION",
      "Owner report content is not owner-safe.",
    );
  for (const section of snapshot.sections) {
    const metricKeys = new Set(
        section.metrics.map((metric) => metric.metricKey),
      ),
      findingIds = new Set(
        section.findings.map((finding) => finding.findingId),
      );
    if (
      section.findings.some((finding) =>
        finding.supportingMetricKeys.some((key) => !metricKeys.has(key)),
      )
    )
      throw new ReportFoundationError(
        "REPORT_SNAPSHOT_INVALID",
        "A report finding has invalid evidence references.",
      );
    if (
      section.recommendations.some((item) =>
        item.supportingFindingIds.some((id) => !findingIds.has(id)),
      )
    )
      throw new ReportFoundationError(
        "REPORT_SNAPSHOT_INVALID",
        "A report recommendation has invalid finding references.",
      );
    if (
      [
        section.title,
        section.description,
        ...section.findings.flatMap((item) => [item.title, item.summary]),
        ...section.recommendations.flatMap((item) => [
          item.title,
          item.rationale,
        ]),
      ]
        .filter(Boolean)
        .some((value) => /<[^>]+>/.test(value!))
    )
      throw new ReportFoundationError(
        "REPORT_SNAPSHOT_INVALID",
        "Report snapshot text must be plain text.",
      );
  }
  try {
    JSON.stringify(snapshot);
  } catch {
    throw new ReportFoundationError(
      "REPORT_SNAPSHOT_INVALID",
      "Report snapshot is not serializable.",
    );
  }
  return snapshot;
}

function metricValueType(key: string): ReportMetric["valueType"] {
  if (
    [
      "gross-revenue",
      "average-daily-rate",
      "revpar",
      "projected-annual-revenue",
      "projected-adr",
      "operating-expenses",
      "net-operating-income",
      "annual-cash-flow",
      "initial-cash-required",
    ].includes(key)
  )
    return "currency";
  if (
    [
      "occupancy-rate",
      "cancellation-rate",
      "projected-occupancy",
      "cap-rate",
      "cash-on-cash-return",
      "break-even-occupancy",
      "healthy-thread-rate",
      "source-coverage-rate",
    ].includes(key)
  )
    return "percentage";
  return "integer";
}
function aggregateFreshness(values: readonly DataFreshness[]): DataFreshness {
  if (!values.length || values.some((item) => item.status === "unknown"))
    return { status: "unknown" };
  return {
    status: values.some((item) => item.status === "stale")
      ? "stale"
      : "current",
    observedAt: values
      .map((item) => item.observedAt)
      .filter(Boolean)
      .sort()[0],
    retrievedAt: values
      .map((item) => item.retrievedAt)
      .filter(Boolean)
      .sort()
      .at(-1),
  };
}
function dedupeLineage(values: readonly SourceLineage[]) {
  return Object.freeze(
    [
      ...new Map(
        values.map((value) => [JSON.stringify(value), value]),
      ).values(),
    ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
}
function dedupeGaps(values: readonly ReportDataGap[]) {
  return Object.freeze(
    [...new Map(values.map((value) => [value.gapId, value])).values()].sort(
      (a, b) => a.gapId.localeCompare(b.gapId),
    ),
  );
}
function inferColumns(
  rows: readonly Readonly<Record<string, number | string | boolean | null>>[],
) {
  const row = rows[0] ?? {};
  return Object.freeze(
    Object.keys(row)
      .sort()
      .map((key) =>
        Object.freeze({
          key,
          label: key,
          valueType:
            typeof row[key] === "number"
              ? ("decimal" as const)
              : typeof row[key] === "boolean"
                ? ("boolean" as const)
                : ("text" as const),
        }),
      ),
  );
}
function fingerprintRequest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function plain(value: string) {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/<[^>]*>/g, "")
    .trim();
  return normalized.slice(0, 2000);
}
function safeFailure(cause: unknown): {
  code: ReportFoundationError["code"];
  message: string;
} {
  if (cause instanceof ReportFoundationError)
    return { code: cause.code, message: cause.message.slice(0, 500) };
  return {
    code: "REPORT_GENERATION_FAILED",
    message: "Report generation failed safely.",
  };
}
function safeMetadata(
  correlationId: string,
  version: ReportVersion,
  catalog: StandardReportCatalogEntry,
) {
  return {
    correlationId,
    reportId: version.reportId,
    versionId: version.reportVersionId,
    versionNumber: version.versionNumber,
    definitionId: catalog.definitionId,
    definitionVersion: catalog.definitionVersion,
    family: catalog.family,
    scopeKind: version.scope.kind,
    propertyCount: version.authorizedPropertyIds.length,
  };
}
function resultOf(version: ReportVersion): GenerateReportResult {
  return {
    reportId: version.reportId,
    versionId: version.reportVersionId,
    versionNumber: version.versionNumber,
    status: "ready",
    generatedAt: version.generatedAt!,
  };
}

export class ReportQueries {
  constructor(private readonly repository: ReportRepository) {}
  async getReport(reportId: string, actor: ReportActor) {
    const report = await this.repository.getReport(reportId, actor);
    if (!report)
      throw new ReportFoundationError(
        "REPORT_VERSION_NOT_FOUND",
        "Report was not found.",
      );
    return report;
  }
  async getVersion(reportId: string, versionId: string, actor: ReportActor) {
    const version = await this.repository.getVersion(
      reportId,
      versionId,
      actor,
    );
    if (!version)
      throw new ReportFoundationError(
        "REPORT_VERSION_NOT_FOUND",
        "Report version was not found.",
      );
    return version;
  }
  list(actor: ReportActor) {
    return this.repository.listReports(actor);
  }
  versions(reportId: string, actor: ReportActor) {
    return this.repository.listVersions(reportId, actor);
  }
  archive(reportId: string, actor: ReportActor) {
    return this.repository.archiveReport(reportId, actor);
  }
  restore(reportId: string, actor: ReportActor) {
    return this.repository.restoreReport(reportId, actor);
  }
}

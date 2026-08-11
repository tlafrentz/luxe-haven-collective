import {
  REPORT_METRIC_SOURCE_MATRIX,
  STANDARD_REPORT_CATALOG,
  type CatalogSectionDefinition,
} from "./catalog";
import type { ReportScopeKind, ReportVisibility } from "./model";
import { ReportFoundationError } from "./model";

export type CustomReportConfiguration = Readonly<{
  schemaVersion: 1;
  title: string;
  introductoryNote?: string;
  visibility: Extract<ReportVisibility, "internal" | "owner_safe">;
  sections: readonly Readonly<{
    sectionKey: string;
    order: number;
    metricKeys: readonly string[];
  }>[];
  presentation: Readonly<{
    includeCoverPage: boolean;
    includeTableOfContents: boolean;
    includeDataQualitySection: true;
    includeLineageAppendix: boolean;
  }>;
}>;
export type CustomReportSectionDefinition = Readonly<{
  key: string;
  version: 1;
  label: string;
  description: string;
  supportedScopeKinds: readonly ReportScopeKind[];
  supportedVisibility: readonly ReportVisibility[];
  requiredMetricKeys: readonly string[];
  optionalMetricKeys: readonly string[];
  required: boolean;
  supportsComparison: boolean;
  maximumInstances: 1;
  exportPolicy: Readonly<{
    pdf: "supported";
    csv: "supported" | "unsupported";
  }>;
}>;
const sourceSections = STANDARD_REPORT_CATALOG.filter(
  (item) => item.family !== "custom",
).flatMap((item) => item.sectionDefinitions);
export const CUSTOM_REPORT_SECTION_REGISTRY: readonly CustomReportSectionDefinition[] =
  Object.freeze(
    [
      ...new Map(
        sourceSections.map((section) => [section.key, section]),
      ).values(),
    ].map((section) => custom(section)),
  );
function custom(
  section: CatalogSectionDefinition,
): CustomReportSectionDefinition {
  return Object.freeze({
    key: section.key,
    version: 1,
    label: section.title,
    description: section.purpose,
    supportedScopeKinds: section.supportedScopes,
    supportedVisibility: Object.freeze([
      ...new Set(
        sourceSections
          .filter((item) => item.key === section.key)
          .map((item) => item.visibility),
      ),
    ]) as readonly ReportVisibility[],
    requiredMetricKeys: Object.freeze([]),
    optionalMetricKeys: section.metricKeys,
    required: false,
    supportsComparison: section.metricKeys.length > 0,
    maximumInstances: 1,
    exportPolicy: {
      pdf: "supported",
      csv: section.csvEligible ? "supported" : "unsupported",
    } as const,
  });
}
export function customReportOptions(
  input: Readonly<{
    scopeKind: ReportScopeKind;
    visibility: "internal" | "owner_safe";
  }>,
) {
  return Object.freeze(
    CUSTOM_REPORT_SECTION_REGISTRY.filter(
      (section) =>
        section.supportedScopeKinds.includes(input.scopeKind) &&
        section.supportedVisibility.includes(input.visibility),
    ).map((section) => {
      const metrics = Object.freeze(
        section.optionalMetricKeys
          .flatMap((key) => {
            const metric = REPORT_METRIC_SOURCE_MATRIX.find(
              (item) => item.metricKey === key,
            );
            return metric ? [metric] : [];
          })
          .filter(
            (metric) =>
              input.visibility !== "owner_safe" ||
              metric.visibility === "owner_safe",
          ),
      );
      return Object.freeze({
        ...section,
        optionalMetricKeys: Object.freeze(
          metrics.map((metric) => metric.metricKey),
        ),
        metrics,
      });
    }),
  );
}
export function normalizeCustomReportConfiguration(
  input: Readonly<{
    title: string;
    introductoryNote?: string;
    visibility: "internal" | "owner_safe";
    scopeKind: ReportScopeKind;
    sections: readonly Readonly<{
      sectionKey: string;
      order: number;
      metricKeys?: readonly string[];
    }>[];
    presentation?: Partial<CustomReportConfiguration["presentation"]>;
  }>,
): CustomReportConfiguration {
  const title = plain(input.title, 160),
    note = input.introductoryNote
      ? plain(input.introductoryNote, 1000)
      : undefined;
  if (!title)
    throw new ReportFoundationError(
      "REPORT_INVALID_CONFIGURATION",
      "A custom report title is required.",
    );
  if (!input.sections.length || input.sections.length > 20)
    throw new ReportFoundationError(
      "REPORT_INVALID_CONFIGURATION",
      "Choose between one and twenty report sections.",
    );
  const keys = input.sections.map((item) => item.sectionKey);
  if (new Set(keys).size !== keys.length)
    throw new ReportFoundationError(
      "REPORT_INVALID_CONFIGURATION",
      "Custom report sections must be unique.",
    );
  const eligible = new Map(
    customReportOptions({
      scopeKind: input.scopeKind,
      visibility: input.visibility,
    }).map((item) => [item.key, item]),
  );
  const normalized = input.sections.map((item) => {
    const definition = eligible.get(item.sectionKey);
    if (!definition)
      throw new ReportFoundationError(
        input.visibility === "owner_safe"
          ? "REPORT_DISCLOSURE_VIOLATION"
          : "REPORT_INVALID_CONFIGURATION",
        "A custom report section is incompatible.",
      );
    const metricKeys = item.metricKeys ?? definition.optionalMetricKeys;
    if (
      new Set(metricKeys).size !== metricKeys.length ||
      metricKeys.some((key) => !definition.optionalMetricKeys.includes(key))
    )
      throw new ReportFoundationError(
        "REPORT_INVALID_CONFIGURATION",
        "A custom report metric is incompatible.",
      );
    return Object.freeze({
      sectionKey: item.sectionKey,
      order: 0,
      metricKeys: Object.freeze([...metricKeys].sort()),
    });
  });
  const ordered = [...input.sections]
    .sort((a, b) => a.order - b.order)
    .map((item) => normalized[input.sections.indexOf(item)]!)
    .map((item, order) => Object.freeze({ ...item, order }));
  return Object.freeze({
    schemaVersion: 1,
    title,
    ...(note ? { introductoryNote: note } : {}),
    visibility: input.visibility,
    sections: Object.freeze(ordered),
    presentation: Object.freeze({
      includeCoverPage: input.presentation?.includeCoverPage !== false,
      includeTableOfContents:
        input.presentation?.includeTableOfContents !== false,
      includeDataQualitySection: true,
      includeLineageAppendix:
        input.presentation?.includeLineageAppendix !== false,
    }),
  });
}
function plain(value: string, max: number) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

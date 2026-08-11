import { ReportFoundationError } from "./model";
export type ReportingProductionConfiguration = Readonly<{
  reportingEnabled: boolean;
  customReportsEnabled: boolean;
  pdfExportsEnabled: boolean;
  csvExportsEnabled: boolean;
  exportRetentionDays: number;
  exportDownloadTtlSeconds: number;
  maximumExportDurationMs: number;
  maximumPdfPages: number;
  maximumPdfArtifactBytes: number;
  maximumCsvRows: number;
  maximumCsvColumns: number;
  maximumCsvCellCharacters: number;
  maximumCsvArtifactBytes: number;
  maximumZipEntries: number;
  maximumZipArtifactBytes: number;
}>;
const bounds = {
  exportRetentionDays: [1, 365],
  exportDownloadTtlSeconds: [30, 900],
  maximumExportDurationMs: [1000, 300000],
  maximumPdfPages: [1, 500],
  maximumPdfArtifactBytes: [1024, 100_000_000],
  maximumCsvRows: [1, 1_000_000],
  maximumCsvColumns: [1, 500],
  maximumCsvCellCharacters: [1, 100_000],
  maximumCsvArtifactBytes: [1024, 250_000_000],
  maximumZipEntries: [1, 100],
  maximumZipArtifactBytes: [1024, 500_000_000],
} as const;
const defaults = {
  exportRetentionDays: 30,
  exportDownloadTtlSeconds: 120,
  maximumExportDurationMs: 60000,
  maximumPdfPages: 200,
  maximumPdfArtifactBytes: 25_000_000,
  maximumCsvRows: 100_000,
  maximumCsvColumns: 100,
  maximumCsvCellCharacters: 10_000,
  maximumCsvArtifactBytes: 50_000_000,
  maximumZipEntries: 25,
  maximumZipArtifactBytes: 100_000_000,
} as const;
export function parseReportingProductionConfiguration(
  env: Readonly<Record<string, string | undefined>>,
): ReportingProductionConfiguration {
  const bool = (key: string) => {
    if (env[key] !== "true" && env[key] !== "false") throw invalid(key);
    return env[key] === "true";
  };
  const number = <K extends keyof typeof bounds>(key: K, envKey: string) => {
    const raw = env[envKey],
      value = raw === undefined ? defaults[key] : Number(raw),
      [min, max] = bounds[key];
    if (!Number.isInteger(value) || value < min || value > max)
      throw invalid(envKey);
    return value;
  };
  return Object.freeze({
    reportingEnabled: bool("REPORTING_ENABLED"),
    customReportsEnabled: bool("REPORTING_CUSTOM_REPORTS_ENABLED"),
    pdfExportsEnabled: bool("REPORTING_PDF_EXPORTS_ENABLED"),
    csvExportsEnabled: bool("REPORTING_CSV_EXPORTS_ENABLED"),
    exportRetentionDays: number(
      "exportRetentionDays",
      "REPORTING_EXPORT_RETENTION_DAYS",
    ),
    exportDownloadTtlSeconds: number(
      "exportDownloadTtlSeconds",
      "REPORTING_EXPORT_DOWNLOAD_TTL_SECONDS",
    ),
    maximumExportDurationMs: number(
      "maximumExportDurationMs",
      "REPORTING_MAX_EXPORT_DURATION_MS",
    ),
    maximumPdfPages: number("maximumPdfPages", "REPORTING_MAX_PDF_PAGES"),
    maximumPdfArtifactBytes: number(
      "maximumPdfArtifactBytes",
      "REPORTING_MAX_PDF_ARTIFACT_BYTES",
    ),
    maximumCsvRows: number("maximumCsvRows", "REPORTING_MAX_CSV_ROWS"),
    maximumCsvColumns: number("maximumCsvColumns", "REPORTING_MAX_CSV_COLUMNS"),
    maximumCsvCellCharacters: number(
      "maximumCsvCellCharacters",
      "REPORTING_MAX_CSV_CELL_CHARACTERS",
    ),
    maximumCsvArtifactBytes: number(
      "maximumCsvArtifactBytes",
      "REPORTING_MAX_CSV_ARTIFACT_BYTES",
    ),
    maximumZipEntries: number("maximumZipEntries", "REPORTING_MAX_ZIP_ENTRIES"),
    maximumZipArtifactBytes: number(
      "maximumZipArtifactBytes",
      "REPORTING_MAX_ZIP_ARTIFACT_BYTES",
    ),
  });
}
function invalid(key: string) {
  return new ReportFoundationError(
    "REPORT_INVALID_CONFIGURATION",
    `Reporting production configuration is invalid (${key}).`,
  );
}

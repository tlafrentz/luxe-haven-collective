export type ReportType = "investment-decision" | "property-performance" | "portfolio-performance" | "financial-performance";
export type ReportScopeType = "workspace" | "portfolio" | "property" | "investment-opportunity" | "investment-scenario" | "financial-scope";
export type ReportValueQualification = "actual" | "projected" | "estimated" | "budgeted" | "forecast" | "manual" | "unavailable";
export type ReportConfidence = "high" | "moderate" | "low" | "insufficient-evidence";
export type ReportFreshness = "current" | "partial" | "stale" | "degraded" | "unknown";
export type ReportStatus = "draft" | "queued" | "generating" | "generated" | "generation-failed" | "published" | "archived" | "superseded";
export type ReportJobStage = "queued" | "projection" | "html" | "pdf" | "storage" | "completed";

export type ReportScope = Readonly<{
  type: ReportScopeType;
  workspaceId: string;
  propertyId?: string;
  opportunityId?: string;
  scenarioId?: string;
  portfolioScopeId?: string;
  label: string;
  includedEntityCount?: number;
  partial: boolean;
}>;

export type ReportPeriod = Readonly<{
  preset: "current-month" | "previous-month" | "quarter-to-date" | "previous-quarter" | "year-to-date" | "previous-year" | "trailing-12-months" | "custom" | "analysis-as-of";
  start?: string;
  end: string;
  label: string;
}>;

export type ReportEvidenceReference = Readonly<{
  id: string;
  source: string;
  observedAt?: string;
  confidence: ReportConfidence;
  freshness: ReportFreshness;
}>;

export type ReportMetric = Readonly<{
  key: string;
  label: string;
  displayValue: string;
  rawValue?: number | string;
  unit?: string;
  qualification: ReportValueQualification;
  accessibleDescription: string;
}>;

export type ReportSectionSnapshot = Readonly<{
  key: string;
  title: string;
  order: number;
  status: "included" | "omitted" | "unavailable";
  narrative?: string;
  metrics: readonly ReportMetric[];
  rows?: readonly Readonly<Record<string, string>>[];
  qualification?: ReportValueQualification;
  confidence?: ReportConfidence;
  freshness?: ReportFreshness;
  evidence: readonly ReportEvidenceReference[];
}>;

export type ReportSourceVersion = Readonly<{ source: string; version: string; evaluatedAt?: string }>;

export type ReportProjection = Readonly<{
  reportType: ReportType;
  scope: ReportScope;
  period?: ReportPeriod;
  title: string;
  subtitle?: string;
  summary: string;
  sections: readonly ReportSectionSnapshot[];
  evidence: readonly ReportEvidenceReference[];
  confidence: ReportConfidence;
  freshness: ReportFreshness;
  sourceVersions: readonly ReportSourceVersion[];
  projectionVersion: string;
  evaluatedAt: string;
  accountingBasis?: string;
  reportingCurrency?: string;
}>;

export type ReportDefinition = Readonly<{
  id: string;
  key: ReportType;
  name: string;
  description: string;
  supportedScopes: readonly ReportScopeType[];
  supportsPeriods: boolean;
  requiredEntitlementKey: string;
  requiredProjectionKey: string;
  defaultTemplateId: string;
  requiredSections: readonly string[];
  optionalSections: readonly string[];
  externalSharing: "allowed" | "workspace-policy" | "disabled";
  status: "draft" | "active" | "inactive" | "archived";
}>;

export type ReportTemplate = Readonly<{
  id: string;
  key: string;
  name: string;
  reportType: ReportType;
  version: number;
  status: "draft" | "active" | "inactive" | "archived";
  sectionKeys: readonly string[];
  brand: Readonly<{ name: string; accent: string; confidentiality: string }>;
  createdAt: string;
  activatedAt?: string;
}>;

export type ReportRequest = Readonly<{
  id: string;
  workspaceId: string;
  requestedByProfileId: string;
  reportType: ReportType;
  scope: ReportScope;
  period?: ReportPeriod;
  comparison?: string;
  sourceContext: Readonly<Record<string, string>>;
  templateId: string;
  title?: string;
  subtitle?: string;
  sectionConfiguration: readonly Readonly<{ key: string; included: boolean }>[];
  status: "draft" | "queued" | "generating" | "completed" | "failed" | "cancelled";
  idempotencyKey: string;
  expectedProjectionVersion?: string;
  createdAt: string;
}>;

export type GeneratedReport = Readonly<{
  id: string;
  reportNumber: string;
  workspaceId: string;
  generatedByProfileId: string;
  reportType: ReportType;
  status: ReportStatus;
  title: string;
  subtitle?: string;
  scopeSnapshot: ReportScope;
  periodSnapshot?: ReportPeriod;
  sourceContextSnapshot: Readonly<Record<string, string>>;
  projectionSnapshot: ReportProjection;
  snapshotSchemaVersion: string;
  templateId: string;
  templateVersion: number;
  projectionVersion: string;
  sourceVersions: readonly ReportSourceVersion[];
  confidence: ReportConfidence;
  freshness: ReportFreshness;
  versionNumber: number;
  seriesKey: string;
  supersedesReportId?: string;
  generatedAt: string;
  archivedAt?: string;
}>;

export type ReportArtifact = Readonly<{
  id: string;
  reportId: string;
  type: "html" | "pdf" | "preview-image";
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  rendererVersion: string;
  status: "active" | "superseded" | "deleted";
  createdAt: string;
}>;

export type ReportGenerationJob = Readonly<{
  id: string;
  reportRequestId: string;
  generatedReportId?: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  stage: ReportJobStage;
  attempts: number;
  idempotencyKey: string;
  lockedAt?: string;
  leaseExpiresAt?: string;
  failureCode?: string;
  failureMessage?: string;
  createdAt: string;
}>;

export type ReportShare = Readonly<{
  id: string;
  reportId: string;
  createdByProfileId: string;
  status: "active" | "expired" | "revoked";
  accessMode: "view" | "view-and-download";
  expiresAt?: string;
  maxViews?: number;
  viewCount: number;
  createdAt: string;
  lastViewedAt?: string;
  revokedAt?: string;
}>;

export class ReportingError extends Error {
  constructor(public readonly code:
    | "report_definition_not_found" | "report_template_not_found" | "report_template_inactive"
    | "report_scope_invalid" | "report_source_not_ready" | "report_permission_denied"
    | "report_entitlement_required" | "report_projection_invalid" | "report_snapshot_too_large"
    | "report_generation_conflict" | "report_generation_failed" | "report_share_not_allowed"
    | "report_share_expired" | "report_share_revoked" | "report_share_limit_reached"
    | "report_idempotency_conflict" | "report_unexpected",
  message: string) { super(message); Object.freeze(this); }
}

import type { ReportCategory, ReportFormat } from "./report-registry";

export type ReportScopeType = "workspace" | "portfolio" | "property" | "owner" | "investment";

export type ReportScope =
  | Readonly<{ type: "workspace"; workspaceId: string }>
  | Readonly<{ type: "portfolio"; portfolioId: string }>
  | Readonly<{ type: "property"; propertyIds: readonly string[] }>
  | Readonly<{ type: "owner"; ownerId: string }>
  | Readonly<{ type: "investment"; investmentId: string }>;

export type ReportPeriodPreset =
  | "business-day"
  | "current-week"
  | "current-month"
  | "year-to-date"
  | "analysis-as-of"
  | "custom";

export type ReportComparisonType = "none" | "previous-period" | "previous-year" | "budget" | "target";

export type ReportingPeriod = Readonly<{
  preset: ReportPeriodPreset;
  from: string;
  to: string;
  partial: boolean;
}>;

export type ReportComparison = Readonly<{
  type: Exclude<ReportComparisonType, "none">;
  from?: string;
  to?: string;
}>;

export type ReportFilter = Readonly<{
  field: string;
  operator: "equals" | "not-equals" | "in" | "not-in";
  values: readonly string[];
}>;

export type ReportConfiguration = Readonly<{
  reportDefinitionId: string;
  workspaceId: string;
  scope: ReportScope;
  period: ReportingPeriod;
  comparison?: ReportComparison;
  filters: readonly ReportFilter[];
  timezone: string;
  currency: string;
}>;

export type ReportRun = Readonly<{
  id: string;
  reportDefinitionId: string;
  reportDefinitionVersion: number;
  requestedBy: string;
  workspaceId: string;
  configuration: ReportConfiguration;
  status: "queued" | "running" | "completed" | "failed";
  requestedAt: string;
  completedAt?: string;
  dataAsOf?: string;
  generatedArtifactId?: string;
  failureClassification?: string;
}>;

export type SavedReport = Readonly<{
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  reportDefinitionId: string;
  configuration: ReportConfiguration;
  visibility: "private" | "workspace";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}>;

export type ReportSectionState = "loading" | "available" | "partial" | "empty" | "unavailable" | "error" | "stale";

export type ReportAvailabilityState =
  | "available"
  | "available-with-limitations"
  | "insufficient-data"
  | "not-configured"
  | "unauthorized"
  | "temporarily-unavailable";

export type MetricDefinition = Readonly<{
  id: string;
  label: string;
  description: string;
  format: "currency" | "percentage" | "number" | "duration";
  aggregation: "sum" | "average" | "weighted-average" | "ratio" | "latest";
  owningCapability: string;
  calculationVersion: number;
  supportedDimensions: readonly string[];
  dataSensitivity: "standard" | "financial" | "restricted";
}>;

export type ReportArtifactRequest = Readonly<{
  reportRunId: string;
  format: Exclude<ReportFormat, "screen">;
}>;

export type ReportLibrarySummary = Readonly<{
  category: ReportCategory;
  available: number;
  limited: number;
  unavailable: number;
}>;

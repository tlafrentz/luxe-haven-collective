import type { ReportFamily, ReportScopeKind, ReportSectionType, ReportVisibility } from "./model";
import { ReportFoundationError } from "./model";

export type ReportDefinition = Readonly<{ definitionId: string; version: number; family: ReportFamily; reportType: string; title: string; description: string; supportedScopes: readonly ReportScopeKind[]; periodPolicy: "required" | "optional" | "unsupported"; comparisonPolicy: "required" | "optional" | "unsupported"; requiredPermissions: readonly string[]; requiredData: readonly Readonly<{ key: string; required: boolean }>[]; sectionDefinitions: readonly Readonly<{ sectionType: ReportSectionType; order: number; visibility: ReportVisibility }>[]; exportCapabilities: Readonly<{ pdf: boolean; csv: boolean }>; enabled: boolean }>;

const definitions: readonly ReportDefinition[] = Object.freeze([
  define("executive.performance-brief.v1", "executive", "performance_brief", "Executive Performance Brief", ["portfolio", "selected_properties"], "required", "optional", ["summary", "performance", "risks", "opportunities"]),
  define("owner.performance-report.v1", "owner", "owner_performance", "Owner Performance Report", ["owner_portfolio", "property"], "required", "optional", ["summary", "performance", "comparison"], "owner_safe"),
  define("investment.analysis-report.v1", "investment", "investment_analysis", "Investment Analysis Report", ["investment_opportunity"], "optional", "unsupported", ["summary", "cash_flow", "sensitivity", "risks"]),
  define("investment.comparison-report.v1", "investment", "investment_comparison", "Investment Comparison Report", ["investment_comparison"], "optional", "unsupported", ["summary", "comparison", "sensitivity"]),
  define("operations.performance-report.v1", "operations", "operations_performance", "Operations Performance Report", ["portfolio", "selected_properties", "property"], "required", "optional", ["summary", "operations", "guest_experience", "data_quality"]),
  define("custom.report.v1", "custom", "custom", "Custom Report", ["portfolio", "selected_properties", "property", "owner_portfolio", "investment_opportunity", "investment_comparison"], "optional", "optional", ["custom"]),
]);

export const standardReportRegistry = Object.freeze({
  definitions,
  get(definitionId: string, version?: number) { const found = definitions.find(item => item.definitionId === definitionId && (version === undefined || item.version === version)); if (!found) throw new ReportFoundationError("REPORT_DEFINITION_NOT_FOUND", "Report definition was not found."); if (!found.enabled) throw new ReportFoundationError("REPORT_DEFINITION_DISABLED", "Report definition is disabled."); return found; },
  list() { return definitions.filter(item => item.enabled); },
});

function define(definitionId: string, family: ReportFamily, reportType: string, title: string, supportedScopes: readonly ReportScopeKind[], periodPolicy: ReportDefinition["periodPolicy"], comparisonPolicy: ReportDefinition["comparisonPolicy"], sections: readonly ReportSectionType[], visibility: ReportVisibility = "standard"): ReportDefinition {
  return Object.freeze({ definitionId, version: 1, family, reportType, title, description: `${title} canonical definition.`, supportedScopes: Object.freeze(supportedScopes), periodPolicy, comparisonPolicy, requiredPermissions: Object.freeze([`reports.${family}.read`]), requiredData: Object.freeze([]), sectionDefinitions: Object.freeze(sections.map((sectionType, order) => Object.freeze({ sectionType, order, visibility }))), exportCapabilities: Object.freeze({ pdf: false, csv: false }), enabled: true });
}

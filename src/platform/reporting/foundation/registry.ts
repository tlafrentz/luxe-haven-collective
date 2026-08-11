import type { ReportFamily, ReportScopeKind, ReportSectionType, ReportVisibility } from "./model";
import { ReportFoundationError } from "./model";
import { STANDARD_REPORT_CATALOG } from "./catalog";

export type ReportDefinition = Readonly<{ definitionId: string; version: number; family: ReportFamily; reportType: string; title: string; description: string; supportedScopes: readonly ReportScopeKind[]; periodPolicy: "required" | "optional" | "unsupported"; comparisonPolicy: "required" | "optional" | "unsupported"; requiredPermissions: readonly string[]; requiredData: readonly Readonly<{ key: string; required: boolean }>[]; sectionDefinitions: readonly Readonly<{ sectionType: ReportSectionType; order: number; visibility: ReportVisibility }>[]; exportCapabilities: Readonly<{ pdf: boolean; csv: boolean }>; enabled: boolean }>;

const definitions: readonly ReportDefinition[] = Object.freeze(STANDARD_REPORT_CATALOG.map(item => Object.freeze({ definitionId: item.definitionId, version: item.definitionVersion, family: item.family, reportType: item.reportType, title: item.title, description: item.description, supportedScopes: item.supportedScopes, periodPolicy: item.periodPolicy.requirement === "required" ? "required" as const : "optional" as const, comparisonPolicy: item.comparisonPolicy, requiredPermissions: item.requiredPermissions, requiredData: item.dataRequirements.map(requirement => Object.freeze({ key: requirement.key, required: requirement.required })), sectionDefinitions: item.sectionDefinitions.map(section => Object.freeze({ sectionType: section.sectionType, order: section.order, visibility: section.visibility })), exportCapabilities: item.exportCapabilities, enabled: item.enabled })));

export const standardReportRegistry = Object.freeze({
  definitions,
  get(definitionId: string, version?: number) { const found = definitions.find(item => item.definitionId === definitionId && (version === undefined || item.version === version)); if (!found) throw new ReportFoundationError("REPORT_DEFINITION_NOT_FOUND", "Report definition was not found."); if (!found.enabled) throw new ReportFoundationError("REPORT_DEFINITION_DISABLED", "Report definition is disabled."); return found; },
  list() { return definitions.filter(item => item.enabled); },
});

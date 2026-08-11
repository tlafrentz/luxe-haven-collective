import "server-only";
import { parseReportingProductionConfiguration } from "@/platform/reporting";
let resolved:ReturnType<typeof parseReportingProductionConfiguration>|undefined;
export function getReportingProductionConfiguration(){return resolved??=parseReportingProductionConfiguration(process.env)}
export function reportingCapabilities(){const value=getReportingProductionConfiguration();return Object.freeze({reportingAvailable:value.reportingEnabled,customReportsAvailable:value.reportingEnabled&&value.customReportsEnabled,pdfExportAvailable:value.reportingEnabled&&value.pdfExportsEnabled,csvExportAvailable:value.reportingEnabled&&value.csvExportsEnabled})}

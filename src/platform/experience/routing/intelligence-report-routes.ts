export type IntelligenceReportCapability = "revenue" | "financial" | "executive" | "portfolio" | "investment";

/**
 * Intelligence pages request report generation through the canonical Reports
 * workspace. They never address a definition or report artifact directly.
 */
export function getIntelligenceReportRequestHref(capability: IntelligenceReportCapability, view: string) {
  const params = new URLSearchParams({ sourceCapability: capability, sourceView: view });
  return `/dashboard/reports/new?${params.toString()}`;
}

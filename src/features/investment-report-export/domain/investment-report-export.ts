import type { InvestmentReportSnapshot } from "@/features/investment-reports";

export const INVESTMENT_REPORT_EXPORT_TEMPLATE_VERSION = "investment-report-pdf.v1" as const;
export const INVESTMENT_REPORT_EXPORT_DEADLINE_MS = 12_000;
export const INVESTMENT_REPORT_EXPORT_MAX_BYTES = 8_000_000;

export type InvestmentReportExportErrorCode =
  | "REPORT_NOT_FOUND" | "REPORT_UNAUTHORIZED" | "REPORT_SNAPSHOT_INVALID"
  | "EXPORT_VERSION_UNSUPPORTED" | "EXPORT_GENERATION_TIMEOUT" | "EXPORT_RENDER_FAILED"
  | "EXPORT_ARTIFACT_PERSIST_FAILED" | "EXPORT_ARTIFACT_UNAVAILABLE" | "EXPORT_DELIVERY_FAILED";

export class InvestmentReportExportError extends Error {
  constructor(public readonly code: InvestmentReportExportErrorCode, message: string) {
    super(message); this.name = "InvestmentReportExportError";
  }
}

export type ExportMetric = Readonly<{ label: string; value: string; source?: string }>;
export type ExportSection = Readonly<{
  title: string; narrative?: string; metrics?: readonly ExportMetric[];
  bullets?: readonly string[]; table?: Readonly<{ headers: readonly string[]; rows: readonly (readonly string[])[] }>;
}>;
export type InvestmentReportExportView = Readonly<{
  templateVersion: typeof INVESTMENT_REPORT_EXPORT_TEMPLATE_VERSION;
  reportSchemaVersion: string; reportId: string; documentReference: string; title: string;
  strategy: "purchase" | "rental-arbitrage"; recommendation: string; generatedAt: string;
  exportedAt: string; analysisVersion: number; confidentiality: "Confidential";
  coverSubtitle: string; sections: readonly ExportSection[]; filename: string;
}>;

export function buildInvestmentReportExportView(input: Readonly<{
  reportId: string; title: string; strategy: "purchase" | "rental-arbitrage";
  generatedAt: string; snapshot: InvestmentReportSnapshot; exportedAt: Date;
}>): InvestmentReportExportView {
  const s = input.snapshot;
  if (s.schemaVersion !== "investment-report.v1") throw new InvestmentReportExportError("EXPORT_VERSION_UNSUPPORTED", "This report version cannot be exported with the current PDF template.");
  if (!s.lineage?.analysisId || s.lineage.strategy !== input.strategy || !s.decision || !s.financials || !s.score || !s.confidence) {
    throw new InvestmentReportExportError("REPORT_SNAPSHOT_INVALID", "The saved report snapshot is incomplete and cannot be exported.");
  }
  const money = (value?: { amount: number; currency: string }) => value ? formatMoney(value.amount, value.currency) : "Unavailable";
  const percent = (value?: number) => value === undefined || value === null ? "Unavailable" : `${(Math.abs(value) <= 1 ? value * 100 : value).toFixed(1)}%`;
  const financial = s.financials;
  const keyMetrics: ExportMetric[] = input.strategy === "purchase" ? [
    metric("Purchase price", money(financial.purchasePrice)), metric("Initial cash invested", money(financial.initialCashRequired)),
    metric("Annual gross revenue", money(financial.projectedAnnualRevenue)), metric("Net operating income", money(financial.netOperatingIncome)),
    metric("Annual cash flow", money(financial.annualCashFlow)), metric("Cap rate", percent(financial.capRate?.value)),
    metric("Cash-on-cash return", percent(financial.cashOnCashReturn?.value)),
  ] : [
    metric("Monthly rent", money(financial.proposedMonthlyLease)), metric("Initial cash invested", money(financial.initialCashRequired)),
    metric("Annual gross revenue", money(financial.projectedAnnualRevenue)), metric("Net operating income", money(financial.netOperatingIncome)),
    metric("Annual cash flow", money(financial.annualCashFlow)), metric("ROI on invested capital", percent(financial.cashOnCashReturn?.value)),
  ];
  const expenseAssumptions = s.assumptions.filter(item => /clean|utilit|insurance|tax|repair|maintenance|suppl|management|platform|channel|hoa|licens|reserve|rent|lease|expense/i.test(item.label));
  const scenarioData = (s as InvestmentReportSnapshot & { scenarios?: readonly Readonly<{ name: string; summary?: string; metrics?: readonly Readonly<{ label: string; value: string }>[] }>[] }).scenarios;
  const sections: ExportSection[] = [
    { title: "Executive decision summary", narrative: s.decision.summary, metrics: [
      metric("Recommendation", label(s.decision.recommendation)), metric("Investment score", `${s.score.value}/${s.score.scaleMaximum}`),
      metric("Confidence", label(s.confidence.level)), metric("Decision readiness", s.limitations.length ? "Decision-ready with limitations" : "Decision-ready"),
    ], bullets: [...s.decision.rationale, ...s.decision.conditions.map(value => `Condition: ${value}`)] },
    { title: "Property and opportunity summary", metrics: [
      metric("Address", present(s.subject.address)), metric("Property type", present(s.subject.propertyType)),
      metric("Market", present(s.subject.market)), metric("Bedrooms", present(s.subject.bedrooms)),
      metric("Bathrooms", present(s.subject.bathrooms)), metric("Acquisition strategy", label(input.strategy)),
      metric("Source opportunity", s.lineage.opportunityId), metric("Source analysis version", String(s.lineage.analysisVersion)),
    ] },
    { title: "Key financial summary", metrics: keyMetrics },
    { title: "Revenue outlook", metrics: [
      metric("Average daily rate", money(financial.projectedAdr)), metric("Occupancy", percent(financial.projectedOccupancy?.value)),
      metric("Annual gross revenue", money(financial.projectedAnnualRevenue)),
      ...assumptionMetrics(s, /available nights|occupied nights|monthly revenue|other revenue|revenue range/i),
    ] },
    { title: "Operating expenses", metrics: [
      ...expenseAssumptions.map(assumptionMetric), metric("Annual operating expenses", money(financial.operatingExpenses)),
      ...assumptionMetrics(s, /monthly operating expenses|expense ratio/i),
    ] },
    { title: input.strategy === "purchase" ? "Purchase financial performance" : "Rental-arbitrage financial performance", metrics: [
      ...keyMetrics, ...assumptionMetrics(s, input.strategy === "purchase"
        ? /down payment|loan amount|interest rate|loan term|debt service|closing cost|break-even|coverage|payback/i
        : /security deposit|setup|furnishing|launch cost|lease.coverage|break-even|payback/i),
    ] },
    ...(scenarioData?.length ? [{ title: "Scenario and sensitivity analysis", table: {
      headers: ["Scenario", "Summary", "Saved metrics"],
      rows: scenarioData.map(item => [item.name, item.summary ?? "Not provided", item.metrics?.map(value => `${value.label}: ${value.value}`).join("; ") || "Not provided"]),
    } }] : []),
    { title: "Evidence and provenance", table: {
      headers: ["Evidence", "Source", "Confidence", "Observed", "Freshness"],
      rows: s.evidence.length ? s.evidence.map(item => [item.title, item.source, label(item.confidence), item.providerTimestamp ? formatDate(item.providerTimestamp) : "Unavailable", item.freshness ? label(item.freshness) : "Unavailable"]) : [["No external evidence available", "Unavailable", "Unavailable", "Unavailable", "Unavailable"]],
    } },
    { title: "Risks and limitations", bullets: [
      ...s.risks.map(item => `${item.title} (${label(item.severity)}): ${item.description}`),
      ...(s.limitations.length ? s.limitations.map(item => `Limitation: ${item.description}`) : ["No material limitations were recorded."]),
    ] },
    { title: "Assumption ledger", table: {
      headers: ["Assumption", "Value", "Unit", "Source type", "Effective / observed"],
      rows: s.assumptions.length ? s.assumptions.map(item => [label(item.label), present(item.value), item.unit ? label(item.unit) : "Not provided", label(item.sourceType), item.observedAt ? formatDate(item.observedAt) : "Not provided"]) : [["No material assumptions recorded", "Unavailable", "Unavailable", "Unavailable", "Unavailable"]],
    } },
    { title: "Methodology and disclaimer", narrative: "This report reflects the saved investment analysis at a specific point in time. Results depend on the listed assumptions and available evidence, and projections are not guarantees. Independently verify material financial, legal, tax, insurance, zoning, and regulatory considerations.", metrics: [
      metric("Report schema", s.schemaVersion), metric("Export template", INVESTMENT_REPORT_EXPORT_TEMPLATE_VERSION),
      metric("Analysis version", String(s.lineage.analysisVersion)), metric("Report generated", formatDateTime(input.generatedAt)),
      metric("PDF exported", formatDateTime(input.exportedAt.toISOString())),
    ] },
  ];
  return Object.freeze({
    templateVersion: INVESTMENT_REPORT_EXPORT_TEMPLATE_VERSION, reportSchemaVersion: s.schemaVersion,
    reportId: input.reportId, documentReference: shortReference(input.reportId), title: input.title,
    strategy: input.strategy, recommendation: label(s.decision.recommendation), generatedAt: input.generatedAt,
    exportedAt: input.exportedAt.toISOString(), analysisVersion: s.lineage.analysisVersion,
    confidentiality: "Confidential", coverSubtitle: s.subject.address || s.subject.name || "Investment opportunity",
    sections: Object.freeze(sections), filename: filename(s.subject.address || s.subject.name, input.strategy),
  });
}

function assumptionMetrics(s: InvestmentReportSnapshot, pattern: RegExp) { return s.assumptions.filter(item => pattern.test(item.label)).map(assumptionMetric); }
function assumptionMetric(item: InvestmentReportSnapshot["assumptions"][number]): ExportMetric { return metric(label(item.label), present(item.value), label(item.sourceType)); }
function metric(labelValue: string, value: string, source?: string): ExportMetric { return Object.freeze({ label: labelValue, value, ...(source ? { source } : {}) }); }
function present(value: unknown): string { return value === null || value === undefined || value === "" ? "Unavailable" : typeof value === "boolean" ? value ? "Yes" : "No" : String(value); }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(value); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date); }
function label(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("-", " ").replace(/\b\w/g, character => character.toUpperCase()); }
function shortReference(value: string) { return value.replace(/^report-/, "").slice(0, 12).toUpperCase() || "REPORT"; }
function filename(value: string, strategy: string) {
  const slug = value.normalize("NFKD").replace(/[^\x00-\x7F]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "investment";
  return `luxe-haven-investment-report-${slug}-${strategy}.pdf`;
}

import type { InvestmentReportSnapshot } from "@/features/investment-reports";
import type { ExportableInvestmentReport } from "../application/export-investment-report";

export type ExportFixtureName = "complete-purchase" | "complete-rental" | "no-external-data" | "long-content" | "multiple-scenarios" | "dense-evidence" | "negative-cash-flow" | "unavailable-fields";

export function investmentReportExportFixture(name: ExportFixtureName): ExportableInvestmentReport {
  const rental = name === "complete-rental", long = name === "long-content", negative = name === "negative-cash-flow";
  const strategy = rental ? "rental-arbitrage" as const : "purchase" as const;
  const assumptions = Array.from({ length: long ? 34 : 12 }, (_, index) => ({
    label: index === 0 ? "occupancy" : index === 1 ? "cleaning expense" : `material assumption ${index + 1}${long ? " with a deliberately long descriptive label for wrapping verification" : ""}`,
    value: index === 0 ? .64 : index === 1 ? 7200 : index * 100, unit: index === 0 ? "percentage" : "currency",
    sourceType: index % 3 === 0 ? "user" as const : index % 3 === 1 ? "provider" as const : "calculated" as const,
    observedAt: index % 2 ? "2026-06-15T00:00:00Z" : undefined,
  }));
  const evidenceCount = name === "dense-evidence" ? 22 : name === "no-external-data" ? 0 : 4;
  const limitationCount = name === "dense-evidence" ? 12 : name === "no-external-data" ? 3 : 2;
  const snapshot: InvestmentReportSnapshot & { scenarios?: readonly { name: string; summary: string; metrics: readonly { label: string; value: string }[] }[] } = {
    schemaVersion: "investment-report.v1", analysisProjectionVersion: "investment-analysis-projection.v1",
    lineage: { opportunityId: "investment-opportunity-fixture", analysisId: "opportunity-analysis-fixture", analysisVersion: 4, strategy, calculationPolicyVersion: "investment-analysis.v3", scorePolicyVersion: "investment-score.v2", sourceLineage: { investmentLifecycleResultId: "fixture-lifecycle" } },
    subject: { name: "Lakeside Investment", address: long ? "650 South Main Street, Building Twelve, Penthouse Residence With An Exceptionally Long Address, Austin, Texas 78701" : "650 S Main St, Austin, TX 78701", propertyType: name === "unavailable-fields" ? null : "Single Family", bedrooms: name === "unavailable-fields" ? null : 4, bathrooms: name === "unavailable-fields" ? null : 3, market: name === "unavailable-fields" ? null : "Austin" },
    decision: { recommendation: negative ? "pass" : "buy-with-conditions", summary: negative ? "Negative cash flow makes this opportunity unsuitable under the saved base case." : "Proceed subject to verification of demand, licensing, and the recorded operating assumptions.", rationale: ["Saved projected cash flow supports the recommendation.", "Evidence coverage is reflected in confidence and limitations."], conditions: ["Verify zoning and short-term-rental licensing before commitment."] },
    score: { value: negative ? 42 : 81, scaleMinimum: 0, scaleMaximum: 100 }, confidence: { level: evidenceCount ? "moderate" : "low", explanation: evidenceCount ? "Supported by saved evidence with recorded limitations." : "No external market evidence was available." },
    financials: { ...(strategy === "purchase" ? { purchasePrice: { amount: 825000, currency: "USD" as const }, capRate: { value: .074 } } : { proposedMonthlyLease: { amount: 4200, currency: "USD" as const } }), projectedAnnualRevenue: { amount: 112000, currency: "USD" }, projectedAdr: { amount: 325, currency: "USD" }, projectedOccupancy: { value: .64 }, operatingExpenses: { amount: 39000, currency: "USD" }, netOperatingIncome: { amount: 73000, currency: "USD" }, annualCashFlow: { amount: negative ? -14500 : 31200, currency: "USD" }, cashOnCashReturn: { value: negative ? -.058 : .127 }, initialCashRequired: { amount: strategy === "purchase" ? 246000 : 27500, currency: "USD" } },
    market: { name: "Austin", medianAdr: { amount: 310, currency: "USD" }, medianOccupancy: { value: .61 }, trend: "stable" },
    risks: Array.from({ length: name === "dense-evidence" ? 10 : 3 }, (_, index) => ({ id: `risk-${index}`, title: `Material risk ${index + 1}`, description: `Saved risk disclosure ${index + 1} with mitigation and decision relevance.`, severity: index % 2 ? "moderate" : "high", probability: .35, mitigation: "Verify before commitment." })),
    limitations: Array.from({ length: limitationCount }, (_, index) => ({ code: `LIMIT-${index}`, description: name === "no-external-data" && index === 0 ? "No external market data available." : `Saved material limitation ${index + 1}; this information was unavailable at report generation.` })),
    evidence: Array.from({ length: evidenceCount }, (_, index) => ({ id: `evidence-${index}`, title: `Market observation ${index + 1}`, source: index % 2 ? "User-supplied assumption" : "Provider-derived estimate", confidence: index % 3 ? "moderate" : "low", providerTimestamp: "2026-06-15T00:00:00Z", freshness: index % 2 ? "current" : "stale" })),
    assumptions, sourceSummary: { userSuppliedCount: 4, learningSuppliedCount: 1, marketSuppliedCount: evidenceCount, defaultSuppliedCount: 2, overrides: [], marketEvidenceAvailable: evidenceCount > 0 },
    policyVersions: { opportunitySnapshotSchema: "1", investmentAnalysisPolicy: "investment-analysis.v3", investmentRecommendationPolicy: "investment-score.v2" },
    analyzedAt: "2026-07-20T14:00:00Z", generatedAt: "2026-07-21T15:30:00Z", currency: "USD",
    ...(name === "multiple-scenarios" ? { scenarios: [
      { name: "Base case", summary: "Saved base assumptions.", metrics: [{ label: "Annual revenue", value: "$112,000" }] },
      { name: "Downside case", summary: "Lower saved occupancy.", metrics: [{ label: "Annual revenue", value: "$84,000" }] },
      { name: "Upside case", summary: "Higher saved ADR.", metrics: [{ label: "Annual revenue", value: "$131,000" }] },
    ] } : {}),
  };
  return { id: `report-fixture-${name}`, title: "Lakeside Investment - Investment Decision", strategy, status: name === "no-external-data" ? "archived" : "active", generatedAt: snapshot.generatedAt, snapshot };
}

export const EXPORT_FIXTURE_NAMES: readonly ExportFixtureName[] = ["complete-purchase", "complete-rental", "no-external-data", "long-content", "multiple-scenarios", "dense-evidence", "negative-cash-flow", "unavailable-fields"];

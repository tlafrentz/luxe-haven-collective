import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/actions/investment-reports", () => ({ transitionInvestmentReportAction: vi.fn() }));
import { InvestmentReportDetail } from "./investment-report-detail";
import { buildInvestmentReportView, type InvestmentReportRecord, type InvestmentReportSnapshot } from "..";

const snapshot = (strategy: "purchase" | "rental-arbitrage"): InvestmentReportSnapshot => ({
  schemaVersion: "investment-report.v1", analysisProjectionVersion: "investment-analysis-projection.v1",
  lineage: { opportunityId: "investment-opportunity-1", analysisId: "opportunity-analysis-1", analysisVersion: 2, strategy, sourceLineage: {} },
  subject: { name: "Deal", address: "1 Main", propertyType: null, bedrooms: null, bathrooms: null, market: null },
  decision: { recommendation: "buy", summary: "Proceed.", rationale: ["Positive cash flow"], conditions: [] },
  score: { value: 80, scaleMinimum: 0, scaleMaximum: 100 }, confidence: { level: "low" },
  financials: { projectedAnnualRevenue: { amount: 100, currency: "USD" }, projectedAdr: { amount: 1, currency: "USD" }, projectedOccupancy: { value: .5 }, operatingExpenses: { amount: 20, currency: "USD" }, annualCashFlow: { amount: 40, currency: "USD" }, cashOnCashReturn: { value: .1 }, initialCashRequired: { amount: 50, currency: "USD" }, ...(strategy === "purchase" ? { purchasePrice: { amount: 500, currency: "USD" as const } } : { proposedMonthlyLease: { amount: 10, currency: "USD" as const } }) },
  market: { name: "Market", medianAdr: { amount: 1, currency: "USD" }, medianOccupancy: { value: .5 }, trend: "stable" }, risks: [],
  limitations: [{ code: "missing", description: "No external market data available." }], evidence: [], assumptions: [],
  sourceSummary: { userSuppliedCount: 1, learningSuppliedCount: 0, marketSuppliedCount: 0, defaultSuppliedCount: 0, overrides: [], marketEvidenceAvailable: false },
  policyVersions: { opportunitySnapshotSchema: "1" }, analyzedAt: "2026-07-01T00:00:00Z", generatedAt: "2026-07-30T00:00:00Z", currency: "USD",
});
const record = (strategy: "purchase" | "rental-arbitrage"): InvestmentReportRecord => ({ id: "report-1", ownerId: "u1", opportunityId: "investment-opportunity-1", analysisId: "opportunity-analysis-1", status: "active", title: "Decision", strategy, generatedAt: "2026-07-30T00:00:00Z", archivedAt: null, snapshot: snapshot(strategy) });

describe("InvestmentReportDetail", () => {
  it("renders purchase-only performance and unavailable missing values", () => {
    const html = renderToStaticMarkup(<InvestmentReportDetail report={buildInvestmentReportView(record("purchase"))} />);
    expect(html).toContain("Purchase financial performance"); expect(html).toContain("Purchase price");
    expect(html).not.toContain("Monthly rent"); expect(html).toContain("Unavailable"); expect(html).toContain("No external market data available"); expect(html).toContain("Download PDF");
  });
  it("renders rental-arbitrage metrics without purchase-only metrics", () => {
    const html = renderToStaticMarkup(<InvestmentReportDetail report={buildInvestmentReportView(record("rental-arbitrage"))} />);
    expect(html).toContain("Rental-arbitrage financial performance"); expect(html).toContain("Monthly rent");
    expect(html).not.toContain("Purchase price");
  });
});

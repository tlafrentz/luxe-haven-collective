import { describe, expect, it } from "vitest";
import { buildInvestmentReportExportView } from "./investment-report-export";
import { investmentReportExportFixture } from "../testing/export-fixtures";

describe("investment report export view model", () => {
  it.each(["complete-purchase", "complete-rental"] as const)("builds snapshot-only strategy content for %s", name => {
    const report = investmentReportExportFixture(name), view = buildInvestmentReportExportView({ reportId: report.id, title: report.title, strategy: report.strategy, generatedAt: report.generatedAt, snapshot: report.snapshot, exportedAt: new Date("2026-07-30T12:00:00Z") });
    const text = JSON.stringify(view);
    expect(text).toContain("Executive decision summary"); expect(text).toContain("Revenue outlook"); expect(text).toContain("Assumption ledger");
    if (report.strategy === "purchase") { expect(text).toContain("Purchase financial performance"); expect(text).not.toContain("Rental-arbitrage financial performance"); }
    else { expect(text).toContain("Rental-arbitrage financial performance"); expect(text).not.toContain("Purchase financial performance"); expect(text).not.toContain("Purchase price"); }
  });
  it("keeps unavailable, zero, and negative values distinct", () => {
    const unavailable = investmentReportExportFixture("unavailable-fields"), negative = investmentReportExportFixture("negative-cash-flow");
    const view = (report: typeof unavailable) => buildInvestmentReportExportView({ reportId: report.id, title: report.title, strategy: report.strategy, generatedAt: report.generatedAt, snapshot: report.snapshot, exportedAt: new Date() });
    expect(JSON.stringify(view(unavailable))).toContain("Unavailable");
    expect(JSON.stringify(view(negative))).toContain("-$14,500");
    const zero = structuredClone(unavailable); (zero.snapshot.financials.annualCashFlow as { amount: number }).amount = 0;
    expect(JSON.stringify(view(zero))).toContain("$0");
  });
  it("includes saved scenarios but never constructs them", () => {
    const report = investmentReportExportFixture("multiple-scenarios"), result = buildInvestmentReportExportView({ reportId: report.id, title: report.title, strategy: report.strategy, generatedAt: report.generatedAt, snapshot: report.snapshot, exportedAt: new Date() });
    expect(JSON.stringify(result)).toContain("Downside case");
  });
  it("creates a sanitized stable filename", () => {
    const report = investmentReportExportFixture("complete-purchase"), result = buildInvestmentReportExportView({ reportId: report.id, title: report.title, strategy: report.strategy, generatedAt: report.generatedAt, snapshot: report.snapshot, exportedAt: new Date() });
    expect(result.filename).toBe("luxe-haven-investment-report-650-s-main-st-austin-tx-78701-purchase.pdf");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildSharedInvestmentReportView } from "../domain/investment-report-share";
import { investmentReportExportFixture } from "@/features/investment-report-export/testing/export-fixtures";
import { SharedInvestmentReport, SharedReportUnavailable } from "./shared-investment-report";

function html(name: "complete-purchase" | "complete-rental" | "unavailable-fields") {
  const report = investmentReportExportFixture(name), view = buildSharedInvestmentReportView({ title: report.title, strategy: report.strategy, generatedAt: report.generatedAt, expiresAt: "2026-08-06T00:00:00Z", allowPdfDownload: true, snapshot: report.snapshot });
  return renderToStaticMarkup(<SharedInvestmentReport view={view} />);
}
describe("shared investment report presentation", () => {
  it("renders purchase content with risks, evidence, assumptions, and PDF permission", () => {
    const value = html("complete-purchase");
    expect(value).toContain("Read-only shared report"); expect(value).toContain("Purchase financial performance"); expect(value).toContain("Purchase price");
    expect(value).toContain("Evidence and provenance"); expect(value).toContain("Risks and limitations"); expect(value).toContain("Assumption ledger"); expect(value).toContain("Download PDF");
  });
  it("renders rental content without purchase-only metrics", () => {
    const value = html("complete-rental");
    expect(value).toContain("Rental-arbitrage financial performance"); expect(value).toContain("Monthly rent"); expect(value).not.toContain("Purchase price");
  });
  it("uses unavailable rather than zero and omits all owner-only controls", () => {
    const value = html("unavailable-fields");
    expect(value).toContain("Unavailable"); expect(value).not.toContain("Open source"); expect(value).not.toContain("Archive report"); expect(value).not.toContain("Share Report"); expect(value).not.toContain("recipient");
    expect(value).not.toContain("investment-opportunity-fixture"); expect(value).not.toContain("opportunity-analysis-fixture");
  });
  it("uses a common non-disclosing terminal state", () => {
    const value = renderToStaticMarkup(<SharedReportUnavailable />);
    expect(value).toContain("invalid, expired, or revoked"); expect(value).not.toContain("report-");
  });
});

import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildInvestmentReportExportView } from "../domain/investment-report-export";
import { EXPORT_FIXTURE_NAMES, investmentReportExportFixture } from "../testing/export-fixtures";
import { renderInvestmentReportPdf } from "./render-investment-report-pdf";

async function render(name: Parameters<typeof investmentReportExportFixture>[0]) {
  const report = investmentReportExportFixture(name), view = buildInvestmentReportExportView({ reportId: report.id, title: report.title, strategy: report.strategy, generatedAt: report.generatedAt, snapshot: report.snapshot, exportedAt: new Date("2026-07-30T12:00:00Z") });
  return { view, bytes: await renderInvestmentReportPdf(view) };
}
async function parse(bytes: Uint8Array) {
  const document = await getDocument({ data: bytes.slice(), useSystemFonts: false, disableFontFace: true }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index), content = await page.getTextContent();
    pages.push(content.items.flatMap(item => "str" in item ? [item.str] : []).join(" "));
  }
  return { pageCount: document.numPages, text: pages.join("\n"), pages };
}

describe("versioned investment report PDF renderer", () => {
  it.each(EXPORT_FIXTURE_NAMES)("renders and independently parses %s", async name => {
    const { bytes } = await render(name), parsed = await parse(bytes);
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toMatch(/^%PDF-1\./);
    expect(bytes.byteLength).toBeGreaterThan(1000); expect(parsed.pageCount).toBeGreaterThan(0);
    expect(parsed.text).toContain("LUXE HAVEN COLLECTIVE"); expect(parsed.text.toLowerCase()).toContain("investment report");
    expect(parsed.text).toContain("Methodology and disclaimer"); expect(parsed.text).toContain("Page 1 of");
    expect(parsed.text).not.toMatch(/api[_-]?key|authorization:\s*bearer|raw_provider_payload|SUPABASE_SERVICE_ROLE_KEY/i);
  });
  it("contains only purchase sections for purchase exports", async () => {
    const parsed = await parse((await render("complete-purchase")).bytes);
    expect(parsed.text).toContain("Purchase financial performance"); expect(parsed.text.toLowerCase()).toContain("purchase price");
    expect(parsed.text).not.toContain("Rental-arbitrage financial performance"); expect(parsed.text).not.toContain("Monthly rent");
  });
  it("contains only rental sections for rental exports", async () => {
    const parsed = await parse((await render("complete-rental")).bytes);
    expect(parsed.text).toContain("Rental-arbitrage financial performance"); expect(parsed.text.toLowerCase()).toContain("monthly rent");
    expect(parsed.text).not.toContain("Purchase financial performance"); expect(parsed.text).not.toContain("Purchase price");
  });
  it("repeats table headers and keeps long fixture content searchable", async () => {
    const parsed = await parse((await render("long-content")).bytes);
    expect(parsed.pageCount).toBeGreaterThan(3);
    expect(parsed.text.match(/ASSUMPTION/g)?.length).toBeGreaterThan(1);
    expect(parsed.text.toLowerCase()).toContain("material assumption 34");
  });
});

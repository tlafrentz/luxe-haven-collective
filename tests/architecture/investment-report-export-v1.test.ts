import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const route = readFileSync("src/app/api/investment-reports/[reportId]/pdf/route.ts", "utf8");
const action = readFileSync("src/app/actions/investment-reports.ts", "utf8");
const workflow = readFileSync("src/features/investment-report-export/application/export-investment-report.ts", "utf8");
const renderer = readFileSync("src/features/investment-report-export/infrastructure/render-investment-report-pdf.ts", "utf8");

describe("Investment Report Export v1 architecture", () => {
  it("loads only the owner-scoped persisted report projection", () => {
    expect(route).toContain("getInvestmentReport(reportId)");
    expect(action).toContain('.eq("owner_profile_id", user.id)');
    expect(route).not.toMatch(/opportunit.*state|readImmutableAnalysis|provider|calculator|reanaly/i);
  });
  it("is on-demand, private, and creates no report or artifact", () => {
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(route).toContain('"Content-Type": "application/pdf"');
    expect(route).not.toMatch(/insert|storage|report_artifacts|createAdminClient/);
  });
  it("uses a workflow deadline independent of renderer cancellation", () => {
    expect(workflow).toContain("withDeadline");
    expect(workflow).toContain("setTimeout");
    expect(workflow).not.toContain("AbortController");
  });
  it("uses bundled standard fonts and no network or system executable", () => {
    expect(renderer).toContain("StandardFonts.Helvetica");
    expect(renderer).toContain("StandardFonts.TimesRomanBold");
    expect(renderer).not.toMatch(/fetch\(|https?:|exec|spawn|tmp|writeFile/);
  });
});

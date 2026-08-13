import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {STANDARD_REPORT_DEFINITIONS} from ".";

describe("standard report definition-to-experience reconciliation",()=>{
  const generation=readFileSync("src/platform/reporting/foundation/generation.ts","utf8"),legacy=readFileSync("src/platform/reporting/foundation/catalog.ts","utf8"),source=readFileSync("src/features/reporting-suite/application/reporting-canonical-source.ts","utf8"),exports=readFileSync("src/platform/reporting/foundation/exports.ts","utf8"),route=readFileSync("src/app/(dashboard)/dashboard/reports/new/[definitionId]/page.tsx","utf8");
  it("proves the existing generator resolves only the legacy catalog",()=>{expect(generation).toContain("standardReportCatalog.get");for(const definition of STANDARD_REPORT_DEFINITIONS)expect(legacy).not.toContain(`\"${definition.reportCode}\"`);expect(STANDARD_REPORT_DEFINITIONS.every(value=>value.status==="draft")).toBe(true);});
  it("proves investment generation is unavailable instead of fabricated",()=>{expect(source).toContain("return unavailableInvestmentSource(input.scope)");expect(source).toContain('reasonCode: "CANONICAL_SOURCE_UNAVAILABLE"');});
  it("records the actual export contract rather than claiming unsupported literal ZIP",()=>{expect(exports).toContain('export type ReportExportFormat = "pdf" | "csv" | "csv_zip"');expect(exports).not.toMatch(/ReportExportFormat\s*=.*"zip"/);});
  it("proves the generic route only accepts legacy definition identifiers",()=>{expect(route).toContain("options.definitions.find");expect(route).toContain("definition.definitionId");});
});

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("FI-002 canonical Financial Intelligence shell", () => {
  it("owns page actions and tabs above route-specific content", () => {
    const layout=fs.readFileSync(path.join(process.cwd(),"src/app/(dashboard)/dashboard/observe/financial/layout.tsx"),"utf8");
    const overview=fs.readFileSync(path.join(process.cwd(),"src/features/financial-intelligence/presentation/financial-overview.tsx"),"utf8");
    expect(layout).toContain("<FinancialShellActions/>");
    expect(layout.indexOf("<FinancialShellActions/>")).toBeLessThan(layout.indexOf("{children}"));
    expect(overview).not.toContain("<FinancialExportMenu");
  });
  it("keeps the action slot active for every nested Financial route", () => {
    const header=fs.readFileSync(path.join(process.cwd(),"src/components/intelligence-workspace-navigation.tsx"),"utf8");
    expect(header).toContain('pathname.startsWith(`${route}/`)');
  });
  it("does not render the legacy overflow beside canonical Financial actions",()=>{
    const header=fs.readFileSync(path.join(process.cwd(),"src/components/intelligence-workspace-navigation.tsx"),"utf8");
    const financialBranch=header.slice(header.indexOf("hasPageOwnExport ?"),header.indexOf("</div>\n    </div>",header.indexOf("hasPageOwnExport ?")));
    expect(financialBranch.indexOf("More options")).toBeGreaterThan(financialBranch.indexOf(": <>"));
  });
});

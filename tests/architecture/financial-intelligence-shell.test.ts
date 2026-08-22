import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("FI-002 canonical Financial Intelligence shell", () => {
  it("owns page actions and tabs above route-specific content", () => {
    const observeLayout=fs.readFileSync(path.join(process.cwd(),"src/app/(dashboard)/dashboard/observe/layout.tsx"),"utf8");
    const layout=fs.readFileSync(path.join(process.cwd(),"src/app/(dashboard)/dashboard/observe/financial/layout.tsx"),"utf8");
    const overview=fs.readFileSync(path.join(process.cwd(),"src/features/financial-intelligence/presentation/financial-overview.tsx"),"utf8");
    expect(observeLayout).toContain("<IntelligenceWorkspaceHeader");
    expect(layout).not.toContain("FinancialShellActions");
    expect(overview).not.toContain("<FinancialExportMenu");
  });
  it("shares functional page actions across Revenue and Financial Intelligence", () => {
    const header=fs.readFileSync(path.join(process.cwd(),"src/components/intelligence-workspace-navigation.tsx"),"utf8");
    expect(header).toContain("<IntelligencePageActions capability={observeCapability}/>");
    expect(header).not.toContain('aria-label="More options"');
  });
  it("routes exports through Reports and never browser print",()=>{
    const actions=fs.readFileSync(path.join(process.cwd(),"src/features/financial-intelligence/presentation/financial-shell-actions.tsx"),"utf8");
    const legacy=fs.readFileSync(path.join(process.cwd(),"src/features/financial-intelligence/presentation/financial-export-menu.tsx"),"utf8");
    expect(actions).toContain("/dashboard/reports/new/");
    expect(actions).not.toContain("window.print");
    expect(legacy).not.toContain("window.print");
  });
});

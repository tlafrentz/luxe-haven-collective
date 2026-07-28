import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source=(path:string)=>readFileSync(path,"utf8");

describe("SA-001D canonical reanalysis boundary",()=>{
  it("hydrates through the immutable projection and accepts an exact historical version",()=>{
    const page=source("src/app/(dashboard)/dashboard/investments/new/page.tsx");
    expect(page).toContain("readImmutableAnalysis");
    expect(page).toContain("analysisVersionId:sourceVersionId");
    expect(page).toContain("hydrateReanalysis");
  });
  it("carries the selected source version through the save command",()=>{
    expect(source("src/features/investment-opportunity/components/save-opportunity-panel.tsx")).toContain("sourceAnalysisVersionId");
    const service=source("src/features/investment-opportunity/application/services.ts");
    expect(service).toContain("!command.analysis.sourceAnalysisVersionId");
    expect(service).toContain("some(value => value.id.value === command.analysis.sourceAnalysisVersionId)");
  });
  it("keeps refresh policy and no-change decisions in the application layer",()=>{
    const hydrator=source("src/features/investment-opportunity/application/reanalysis-hydration.ts");
    expect(hydrator).toContain("REANALYSIS_ASSUMPTION_CONTRACT");
    expect(hydrator).toContain("REANALYSIS_REFRESH_NOT_ELIGIBLE");
    expect(hydrator).toContain("shouldCreateReanalysisVersion");
  });
});

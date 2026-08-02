import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("INV-UX-001 investment lifecycle information architecture", () => {
  it("separates Analyze, Scenarios, and Opportunities in Investment Intelligence", () => {
    const navigation = source("src/features/investment-intelligence/components/investment-workspace-shell-navigation.tsx");
    expect(navigation).toContain('label: "Analyze"');
    expect(navigation).toContain('label: "Scenarios"');
    expect(navigation).toContain('label: "Opportunities"');
    expect(navigation).not.toContain('label: "Portfolio"');
  });

  it("saves a new analysis as a scenario before opportunity promotion", () => {
    const panel = source("src/features/investment-opportunity/components/save-opportunity-panel.tsx");
    expect(panel).toContain("Save Scenario");
    expect(panel).toContain("convert it to an Opportunity");
    expect(panel).toContain("saveAnalysisAsScenarioAction");
    expect(panel).not.toContain("saveAnalysisAsNewOpportunityAction");
  });

  it("promotes saved scenarios explicitly from the scenario workspace", () => {
    const scenarios = source("src/app/(dashboard)/dashboard/investments/scenarios/page.tsx");
    const workflow = source("src/app/actions/investment-opportunity-workflow.ts");
    expect(scenarios).toContain("Promote to Opportunity");
    expect(scenarios).toContain("convertScenarioToOpportunityAction");
    expect(workflow).toContain("scenario_only: false");
  });

  it("keeps opportunity saving outside the operating Portfolio boundary", () => {
    const workflow = source("src/app/actions/investment-opportunity-workflow.ts");
    const createOpportunity = workflow.slice(
      workflow.indexOf("export async function saveAnalysisAsNewOpportunityAction"),
      workflow.indexOf("export async function saveAnalysisToOpportunityAction"),
    );
    expect(createOpportunity).toContain("createInvestmentOpportunityWithResult");
    expect(createOpportunity).not.toMatch(/createPortfolio|addToPortfolio|PortfolioProperty/);
  });

  it("does not claim that Investment Intelligence is scoped to the operating portfolio", () => {
    const overview = source("src/features/investment-intelligence/components/investment-intelligence-overview.tsx");
    expect(overview).not.toContain("Entire Portfolio");
    expect(overview).not.toContain("Investment scope:");
  });

  it("uses strategy selection before the canonical five-step analysis workflow", () => {
    const workspace = source("src/features/investment-intelligence/components/investment-workspace.tsx");
    const pages = source("src/features/investment-intelligence/components/investment-analysis-step-pages.tsx");
    expect(workspace).toContain("InvestmentAnalysisStepPages");
    expect(workspace).not.toContain("AcquisitionSetup");
    for (const label of ["Property", "Capital Structure", "Revenue & Operations", "Intelligence", "Decision"]) {
      expect(pages).toContain(`label: "${label}"`);
    }
    expect(pages).toContain("Continue");
    expect(pages).toContain("Back");
    const entry = source("src/app/(dashboard)/dashboard/investments/new/page.tsx");
    expect(entry).toContain("Choose an investment strategy");
    expect(entry).toContain("AcquisitionType.Purchase");
    expect(entry).toContain("AcquisitionType.RentalArbitrage");
    expect(pages).not.toContain("AcquisitionTypeSelector");
  });
});

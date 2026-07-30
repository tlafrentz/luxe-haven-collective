import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("INV-UX-001 investment lifecycle information architecture", () => {
  it("separates Analyze, Saved Scenarios, and Opportunities in Investment Intelligence", () => {
    const navigation = source("src/features/investment-intelligence/components/investment-workspace-shell-navigation.tsx");
    expect(navigation).toContain('label: "Analyze"');
    expect(navigation).toContain('label: "Saved Scenarios"');
    expect(navigation).toContain('label: "Opportunities"');
    expect(navigation).not.toContain('label: "Portfolio"');
  });

  it("presents the existing persistence command as an intentional opportunity promotion", () => {
    const panel = source("src/features/investment-opportunity/components/save-opportunity-panel.tsx");
    expect(panel).toContain("Create Opportunity");
    expect(panel).toContain("not an operating portfolio property");
    expect(panel).toContain("saveAnalysisAsNewOpportunityAction");
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
});

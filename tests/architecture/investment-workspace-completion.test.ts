import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("Investment Workspace Completion boundaries", () => {
  it("keeps workspace navigation focused and report history in opportunity context", () => {
    const navigation = source("src/features/investment-intelligence/components/investment-workspace-shell-navigation.tsx");
    const opportunity = source("src/features/investment-opportunity/components/acquisition-opportunity-workspace.tsx");
    expect([...navigation.matchAll(/label: "([^"]+)"/g)].map(match => match[1])).toEqual(["Overview", "Analyze", "Scenarios", "Opportunities", "Reports", "Settings"]);
    expect(navigation).not.toContain("Templates");
    expect(navigation).not.toContain("History");
    expect(navigation).not.toContain("Saved Reports");
    expect(opportunity).toContain("Immutable decision reports");
    expect(opportunity).toContain("Historical reports");
  });

  it("persists a versioned owner-scoped draft without secrets or provider payloads", () => {
    const state = source("src/features/investment-intelligence/components/investment-workspace-state.tsx");
    const resume = source("src/features/investment-intelligence/components/investment-draft-resume.tsx");
    expect(state).toContain('DRAFT_SCHEMA_VERSION = "investment-workspace-draft.v1"');
    expect(state).toContain("ownerScope");
    expect(state).toContain("window.localStorage");
    expect(state).not.toContain("providerPayload");
    expect(state).not.toContain("authToken");
    expect(resume).toContain("Active draft");
    expect(resume).toContain("Continue Analysis");
  });

  it("keeps report content on the immutable report projection", () => {
    const reports = source("src/app/actions/investment-reports.ts");
    const opportunity = source("src/features/investment-opportunity/components/acquisition-opportunity-workspace.tsx");
    expect(reports).toContain("projection_snapshot");
    expect(opportunity).toContain("report.snapshot.lineage.analysisVersion");
    expect(opportunity).not.toContain("analyzeInvestmentWorkspace");
  });

  it("bounds scenario listing and exposes search, continuation, duplication management, and promotion", () => {
    const scenarios = source("src/app/(dashboard)/dashboard/investments/scenarios/page.tsx");
    expect(scenarios).toContain(".limit(50)");
    expect(scenarios).toContain('name="q"');
    expect(scenarios).toContain("Continue analysis");
    expect(scenarios).toContain("Duplicate or manage");
    expect(scenarios).toContain("Promote to Opportunity");
  });
});

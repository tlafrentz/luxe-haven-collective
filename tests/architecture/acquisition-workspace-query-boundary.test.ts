import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const contracts = source("src/features/investment-opportunity/acquisition-workspace/application/contracts.ts");
const projections = source("src/features/investment-opportunity/acquisition-workspace/application/projections.ts");
const query = source("src/features/investment-opportunity/acquisition-workspace/application/get-acquisition-workspace.ts");

describe("Acquisition Workspace query architecture", () => {
  it("keeps contracts and query free of React, Next, Supabase, and persistence DTOs", () => {
    const application = `${contracts}\n${projections}\n${query}`;
    expect(application).not.toMatch(/from ["']react|next\/|supabase|PersistenceRow|infrastructure\/persistence/);
  });

  it("keeps pure projections free of readers, repositories, authorization lookup, and clock lookup", () => {
    expect(projections).not.toMatch(/interface .*Reader|Repository|\.authorize\(|Date\.now\(|new Date\(\)/);
    expect(projections).toContain("evaluatedAt");
  });

  it("exposes source projections rather than aggregates or persistence structures", () => {
    expect(contracts).toContain("AcquisitionWorkspacePipelineSource");
    expect(contracts).not.toMatch(/pipeline: AcquisitionPipeline[;>]|InvestmentOpportunity[;>]|Row\b|Supabase/);
    expect(contracts).toContain("documentCount: number");
    expect(contracts).not.toMatch(/documentUrl|mimeType|storagePath|fileSize/);
  });

  it("keeps route generation centralized and opportunity-centered", () => {
    expect(projections.match(/dashboard\/investments\/opportunities\//g)).toHaveLength(2);
    expect(projections).not.toContain("/acquisitions/");
    expect(contracts).not.toContain("pipelineId: string;\n  opportunityId");
  });

  it("invokes no command handler and returns no mutation interface", () => {
    expect(query).not.toMatch(/activateAcquisitionPipeline|createAcquisitionOffer|submitAcquisitionOffer|recordAcquisitionContract|save\(|update\(|execute\(/);
    expect(contracts).not.toContain("commandId");
    expect(contracts).not.toContain("Supabase");
  });

  it("centralizes every collection maximum", () => {
    expect(contracts).toContain("ACQUISITION_WORKSPACE_LIMITS");
    for (const name of ["activityMaximum", "historyMaximum", "priorOffersMaximum", "requirementsMaximum", "blockersMaximum", "warningsMaximum"]) expect(contracts).toContain(name);
    expect(query).not.toContain("limit: 100");
  });

  it("does not invert feature or platform dependencies", () => {
    const platformFiles = source("src/platform/experience/index.ts") + source("src/platform/kernel/index.ts");
    expect(platformFiles).not.toContain("acquisition-workspace");
    const analysisIndex = source("src/features/investment-intelligence/index.ts");
    expect(analysisIndex).not.toContain("acquisition-workspace");
  });
});

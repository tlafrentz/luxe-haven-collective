import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contracts = readFileSync(new URL("./contracts.ts", import.meta.url), "utf8");
const engine = readFileSync(new URL("./engine.ts", import.meta.url), "utf8");
const lifecycle = readFileSync(new URL("./lifecycle.ts", import.meta.url), "utf8");
const application = readFileSync(new URL("../../application/evaluate-portfolio-recommendations.ts", import.meta.url), "utf8");

describe("Portfolio recommendation architecture", () => {
  it("keeps the pure domain free of React, Next.js, Supabase, providers, repositories, clocks, randomness, and environment access", () => {
    for (const source of [contracts, engine, lifecycle]) {
      expect(source).not.toMatch(/react|next\/|supabase|Repository|ProviderDto|Date\.now|new Date\(\)|Math\.random|randomUUID|process\.env/);
    }
  });

  it("consumes public assessment contracts and Platform confidence without importing engine implementations", () => {
    expect(contracts).toContain("PortfolioHealthAssessment");
    expect(contracts).toContain("CapitalAllocationAssessment");
    expect(contracts).toContain("ConfidenceAssessment");
    expect(contracts).not.toMatch(/health\/engine|allocation\/engine|infrastructure|presentation/);
  });

  it("contains no mutation, Action creation, command dispatch, AI, LLM, or execution path", () => {
    for (const source of [contracts, engine, lifecycle, application]) {
      expect(source).not.toMatch(/createAction|dispatchCommand|mutatePortfolio|approveAcquisition|executeTransaction|OpenAI|LLM|recommendation narrative/i);
    }
    expect(engine).toContain("reversible: true");
  });

  it("loads through application readers while the pure engine performs no I/O", () => {
    expect(application).toContain("input.readers");
    expect(engine).not.toMatch(/await |Promise|fetch\(|readPortfolio|readLatest/);
  });
});

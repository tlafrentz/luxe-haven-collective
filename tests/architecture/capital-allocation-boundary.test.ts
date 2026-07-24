import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "src/features/portfolio-intelligence");
function files(folder: string) {
  const output = execFileSync("find", [resolve(root, folder), "-type", "f", "-name", "*.ts"], { encoding: "utf8" }).trim();
  return output ? output.split("\n").filter((file) => !file.endsWith(".test.ts") && !file.endsWith("test-fixtures.ts")).map((file) => ({ file, source: readFileSync(file, "utf8") })) : [];
}

describe("Capital Allocation architecture", () => {
  it("keeps the allocation domain free of UI, infrastructure, providers, persistence, clocks, environment, and randomness", () => {
    for (const item of files("domain/allocation")) {
      expect(item.source, item.file).not.toMatch(/react|next\/|@supabase|rentcast|process\.env|Date\.now|new Date\(\)|randomUUID|Math\.random|Repository|\.save\(|findLatest|findById/i);
      expect(item.source, item.file).not.toMatch(/from\s+["'][^"']*(components|presentation|infrastructure)/);
    }
  });
  it("does not expose property, opportunity, pipeline, provider, or persistence aggregates", () => {
    const domain = files("domain/allocation").map((item) => item.source).join("\n");
    expect(domain).not.toMatch(/InvestmentOpportunity\b|AcquisitionPipeline\b|PropertyAggregate\b|Supabase|database row|provider dto/i);
    expect(domain).not.toMatch(/createAction|dispatchRecommendation|approveAcquisition|executeTransaction/i);
  });
  it("reuses Platform money, percentages, scoring, weights, confidence, and public Portfolio Health contracts", () => {
    const domain = files("domain/allocation").map((item) => item.source).join("\n");
    expect(domain).toMatch(/Money/);
    expect(domain).toMatch(/Percentage/);
    expect(domain).toMatch(/ScoreBreakdown/);
    expect(domain).toMatch(/Weight/);
    expect(domain).toMatch(/ConfidenceAssessment/);
    expect(domain).toMatch(/PortfolioHealthAssessment/);
  });
  it("performs no Portfolio, Opportunity, Pipeline, or Action mutation", () => {
    const all = [...files("domain/allocation"), ...files("application")].map((item) => item.source).join("\n");
    expect(all).not.toMatch(/\.addProperty|\.removeProperty|\.updateCapital|\.changeHealth|\.recordDecision|\.transitionStatus|\.transition\(|\.closeAcquisition|createAction/);
  });
  it("has deterministic bounded output and no calculation persistence requirement", () => {
    const policy = readFileSync(resolve(root, "domain/allocation/policy.ts"), "utf8");
    const engine = readFileSync(resolve(root, "domain/allocation/engine.ts"), "utf8");
    expect(policy).toMatch(/candidateLimit/);
    expect(policy).toMatch(/alternateLimit/);
    expect(engine).toMatch(/localeCompare/);
    expect(engine).not.toMatch(/Repository|\.save\(/);
  });
});

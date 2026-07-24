import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "src/features/portfolio-intelligence");
const files = (folder: string) => {
  const output = execFileSync("find", [resolve(root, folder), "-type", "f", "-name", "*.ts"], { encoding: "utf8" }).trim();
  return output ? output.split("\n").filter((file) => !file.endsWith(".test.ts") && !file.endsWith("test-fixtures.ts")).map((file) => ({ file, source: readFileSync(file, "utf8") })) : [];
};

describe("Portfolio Health architecture", () => {
  it("keeps domain free of presentation, infrastructure, provider, repository, clock, environment, and random access", () => {
    for (const item of files("domain")) {
      expect(item.source, item.file).not.toMatch(/react|next\/|@supabase|provider dto|rentcast|repository|process\.env|Date\.now|new Date\(\)|randomUUID|Math\.random/i);
      expect(item.source, item.file).not.toMatch(/from\s+["'][^"']*(components|presentation|infrastructure)/);
    }
  });

  it("does not expose external aggregates, persistence rows, recommendations, Actions, or CSS labels", () => {
    for (const item of files("domain")) {
      expect(item.source, item.file).not.toMatch(/InvestmentOpportunity\b|AcquisitionPipeline\b|PropertyAggregate\b|Supabase|database row|className|cssVariant|createAction|recommendation command/i);
    }
  });

  it("reuses Platform scoring, confidence, observations, Result, Money, and Percentage", () => {
    const domain = files("domain").map((item) => item.source).join("\n");
    const application = files("application").map((item) => item.source).join("\n");
    expect(domain).toMatch(/ScoreBreakdown/);
    expect(domain).toMatch(/ConfidenceAssessment/);
    expect(domain).toMatch(/ObservationId/);
    expect(domain).toMatch(/Money/);
    expect(domain).toMatch(/Percentage/);
    expect(application).toMatch(/Result/);
  });

  it("contains no UI and calculation requires no persistence", () => {
    const all = [...files("domain"), ...files("application")];
    expect(all.some((item) => item.file.endsWith(".tsx"))).toBe(false);
    expect(readFileSync(resolve(root, "domain/health/engine.ts"), "utf8")).not.toMatch(/Repository|\.save\(|findLatest|findById/);
  });

  it("does not mutate the PI-001 Portfolio aggregate", () => {
    const application = files("application").map((item) => item.source).join("\n");
    expect(application).not.toMatch(/\.addProperty|\.removeProperty|\.updateCapital|\.changeHealth|\.recordDecision/);
  });
});

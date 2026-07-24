import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(process.cwd(), "src/features/learning-intelligence/outcomes");
const files = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(path.join(directory, entry.name)) : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test-support.ts") ? [path.join(directory, entry.name)] : [],
);
const source = (directory: string) => files(directory).map(file => fs.readFileSync(file, "utf8")).join("\n");

describe("LI-001 Outcomes architecture boundary", () => {
  const domain = source(path.join(root, "domain"));

  it("isolates domain code from UI, infrastructure, providers, clocks, environment, and repositories", () => {
    expect(domain).not.toMatch(/react|next\/|supabase|infrastructure|Repository|process\.env|Date\.now|new Date\(\)|provider DTO/i);
  });

  it("contains no success evaluation, variance calculation, learning, recommendation generation, or source mutation", () => {
    expect(domain).not.toMatch(/successful\s*:|calculateVariance|evaluateSuccess|generateLearning|generateRecommendation|mutateDecision|mutateAction/i);
  });

  it("reuses public platform value primitives and keeps outcome concepts out of the kernel", () => {
    expect(domain).toMatch(/@\/platform\/kernel/);
    expect(domain).toMatch(/@\/platform\/scoring/);
    const kernel = source(path.join(process.cwd(), "src/platform/kernel"));
    expect(kernel).not.toMatch(/OutcomeExpectation|OutcomeMeasurementPlan|OutcomeAttribution/);
  });

  it("keeps infrastructure imports directed toward application and domain", () => {
    const infrastructure = source(path.join(root, "infrastructure"));
    expect(infrastructure).not.toMatch(/react|next\/|supabase/i);
    expect(infrastructure).toMatch(/\.\.\/domain/);
    expect(infrastructure).toMatch(/\.\.\/application/);
  });
});

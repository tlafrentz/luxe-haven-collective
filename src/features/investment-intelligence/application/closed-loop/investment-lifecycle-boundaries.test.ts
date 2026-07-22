import {
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  join,
  relative,
} from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const ROOT = process.cwd();
const FEATURE = join(ROOT, "src/features/investment-intelligence");
const PLATFORM = join(ROOT, "src/platform");

function productionFiles(root: string): readonly string[] {
  return readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .filter((path) => !/\.(test|spec)\.(ts|tsx)$/.test(path))
    .filter((path) => !path.includes("/closed-loop/"));
}

function matches(root: string, pattern: RegExp) {
  return productionFiles(root)
    .filter((path) => pattern.test(readFileSync(path, "utf8")))
    .map((path) => relative(ROOT, path))
    .sort();
}

describe("Investment lifecycle architecture boundaries", () => {
  it("keeps the financial engine independent of Learning and governance", () => {
    const source = readFileSync(
      join(FEATURE, "application/run-investment-analysis.ts"),
      "utf8",
    );
    expect(source).not.toMatch(
      /LearningInsight|LearningApplication|AppliedLearning|PlatformOutcome|PlatformDecision/,
    );
  });

  it("keeps Platform dependency direction independent of Investment features", () => {
    expect(matches(PLATFORM, /features\/investment-intelligence|@\/features\/investment-intelligence/))
      .toEqual([]);
  });

  it("has one production constructor boundary for each Action, Outcome, and Learning artifact", () => {
    expect(matches(FEATURE, /PlatformAction\.create(?:Draft|Committed)/))
      .toEqual([
        "src/features/investment-intelligence/application/adapters/map-investment-execution-plan-to-actions.ts",
      ]);
    expect(matches(FEATURE, /Outcome\.create\(/))
      .toEqual([
        "src/features/investment-intelligence/application/adapters/map-investment-finding-to-outcome.ts",
      ]);
    expect(matches(FEATURE, /LearningInsight\.create\(/))
      .toEqual([
        "src/features/investment-intelligence/application/adapters/map-investment-learning-to-platform.ts",
      ]);
  });

  it("keeps governance, selection, and composition in separate production boundaries", () => {
    expect(matches(FEATURE, /reviewInvestmentLearningApplication\(/))
      .toEqual([
        "src/features/investment-intelligence/application/review-investment-learning-application.ts",
      ]);
    expect(matches(FEATURE, /buildInvestmentAppliedLearningContext\(/))
      .toEqual([
        "src/features/investment-intelligence/application/build-investment-applied-learning-context.ts",
      ]);
    expect(matches(FEATURE, /buildInvestmentAnalysisContext\(/))
      .toEqual([
        "src/features/investment-intelligence/application/build-investment-analysis-context.ts",
      ]);
  });

  it("prevents outcome capture, Learning derivation, and application review from advancing later stages", () => {
    const outcome = readFileSync(join(FEATURE, "application/record-investment-action-outcome.ts"), "utf8");
    const learning = readFileSync(join(FEATURE, "application/derive-investment-learning.ts"), "utf8");
    const review = readFileSync(join(FEATURE, "application/review-investment-learning-application.ts"), "utf8");
    expect(outcome).not.toMatch(/deriveInvestmentLearning|reviewInvestmentLearningApplication|runInvestmentAnalysis/);
    expect(learning).not.toMatch(/reviewInvestmentLearningApplication|buildInvestmentAppliedLearningContext|runInvestmentAnalysis/);
    expect(review).not.toMatch(/buildInvestmentAppliedLearningContext|buildInvestmentAnalysisContext|runInvestmentAnalysis/);
  });
});

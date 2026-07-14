import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createHpmPerformanceReport,
} from "../test-support/factories";

import {
  buildPortfolioHealth,
} from "./build-portfolio-health";

describe("buildPortfolioHealth", () => {
  it("uses the overall score when one is available", () => {
    const result =
      buildPortfolioHealth(
        createHpmPerformanceReport({
          overall: {
            score: 84,
            healthStatus: "healthy",
            measurementStatus: "measured",
            confidence: 80,
            change: {
              difference: 3,
              direction: "up",
            },
          },
        }),
      );

    expect(result).toMatchObject({
      score: 84,
      healthStatus: "healthy",
      measurementStatus: "measured",
      confidence: 80,
    });
  });

  it("explains partial coverage when an overall score is unavailable", () => {
    const result =
      buildPortfolioHealth(
        createHpmPerformanceReport(),
      );

    expect(result.score).toBeNull();
    expect(result.measurementStatus).toBe(
      "partial",
    );
    expect(result.summary).toContain(
      "Revenue performance is currently healthy",
    );
  });
});

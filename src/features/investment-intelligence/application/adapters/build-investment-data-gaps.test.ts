import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createPurchaseLifecycleResult,
  createRentalLifecycleResult,
} from "../__tests__/fixtures/investment-lifecycle.fixture";

import {
  buildInvestmentDataGaps,
} from "./build-investment-data-gaps";

const baseContext = {
  runId: "data-gap-test",
  observedAt:
    new Date("2026-01-01T00:00:00Z"),
  sourceQuality: {
    comparables: "verified",
    utilitiesResponsibility:
      "verified",
    regulation: "verified",
  },
} as const;

describe("buildInvestmentDataGaps", () => {
  it("keeps complete purchase inputs separate from absent upstream lineage", () => {
    const gaps = buildInvestmentDataGaps(
      createPurchaseLifecycleResult(),
      baseContext,
    );

    expect(
      gaps.map(({ code }) => code),
    ).toEqual([
      "missing-upstream-lineage",
      "weak-comparable-confidence",
    ]);
    expect(
      gaps.some(
        ({ code }) =>
          code.includes("cash-flow"),
      ),
    ).toBe(false);
  });

  it("identifies substituted comparable evidence explicitly", () => {
    const gaps = buildInvestmentDataGaps(
      createPurchaseLifecycleResult(),
      {
        ...baseContext,
        sourceQuality: {
          ...baseContext.sourceQuality,
          comparables: "synthetic",
        },
      },
    );

    expect(
      gaps.map(({ code }) => code),
    ).toContain("synthetic-comparables");
  });

  it("identifies unverified rental utilities responsibility", () => {
    const gaps = buildInvestmentDataGaps(
      createRentalLifecycleResult(),
      {
        ...baseContext,
        sourceQuality: {
          ...baseContext.sourceQuality,
          utilitiesResponsibility:
            "unknown",
        },
      },
    );

    expect(
      gaps.map(({ code }) => code),
    ).toContain(
      "missing-utilities-responsibility",
    );
  });

  it("treats an empty upstream envelope as missing artifacts", () => {
    const gaps = buildInvestmentDataGaps(
      createPurchaseLifecycleResult(),
      {
        ...baseContext,
        upstream: {},
      },
    );

    expect(
      gaps.map(({ code }) => code),
    ).toContain(
      "missing-upstream-lineage",
    );
  });
});

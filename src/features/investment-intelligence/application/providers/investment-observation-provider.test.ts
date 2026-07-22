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
  INVESTMENT_OBSERVATION_CAPABILITY,
  INVESTMENT_OBSERVATION_TYPES,
} from "../types/investment-observation-types";

import {
  InvestmentObservationProvider,
} from "./investment-observation-provider";

const context = {
  runId: "investment-run-fixed",
  observedAt:
    new Date("2026-07-19T17:00:00Z"),
  recordedAt:
    new Date("2026-07-19T18:00:00Z"),
} as const;

describe(
  "InvestmentObservationProvider",
  () => {
    it("preserves the purchase observation set and adds comparable context", () => {
      const provider =
        new InvestmentObservationProvider();
      const observations = provider.build(
        createPurchaseLifecycleResult(),
        context,
      );

      expect(provider.capability).toBe(
        INVESTMENT_OBSERVATION_CAPABILITY,
      );
      expect(observations.size)
        .toBeGreaterThanOrEqual(46);
      expect(
        observations.ofType(
          INVESTMENT_OBSERVATION_TYPES
            .strategy.targetOfferPrice,
        ).size,
      ).toBe(1);
      expect(
        observations.ofType(
          INVESTMENT_OBSERVATION_TYPES.market
            .comparableConfidence,
        ).size,
      ).toBe(1);
      expect(
        observations.toArray().every(
          (observation, index) =>
            observation.id.value ===
              `${context.runId}-observation-${index + 1}` &&
            observation.observedAt.getTime() ===
              context.observedAt.getTime() &&
            observation.recordedAt.getTime() ===
              context.recordedAt.getTime(),
        ),
      ).toBe(true);
    });

    it("emits shared and lease-specific rental observations deterministically", () => {
      const provider =
        new InvestmentObservationProvider();
      const result =
        createRentalLifecycleResult();
      const first = provider.build(
        result,
        context,
      );
      const second = provider.build(
        result,
        context,
      );

      expect(first).toEqual(second);
      expect(
        first.ofType(
          INVESTMENT_OBSERVATION_TYPES.revenue
            .projectedAnnualRevenue,
        ).size,
      ).toBe(1);
      expect(
        first.ofType(
          INVESTMENT_OBSERVATION_TYPES
            .rentalArbitrage.monthlyLease,
        ).size,
      ).toBe(1);
      expect(
        first.ofType(
          INVESTMENT_OBSERVATION_TYPES
            .rentalArbitrage.stressOutcome,
        ).size,
      ).toBe(1);
      expect(
        first.ofType(
          INVESTMENT_OBSERVATION_TYPES.score
            .overall,
        ).size,
      ).toBe(1);
    });

    it("rejects invalid run timestamps", () => {
      const provider =
        new InvestmentObservationProvider();

      expect(() =>
        provider.build(
          createPurchaseLifecycleResult(),
          {
            ...context,
            observedAt:
              new Date("invalid"),
          },
        ),
      ).toThrow(
        "Investment Platform artifact date must be valid.",
      );
    });
  },
);

import type {
  Money,
  Percentage,
  RevenueProjection,
} from "../domain";

import {
  assertFiniteNonNegative,
  assertMoney,
  assertPercentage,
  roundCurrency,
} from "./calculation-guards";

export type CalculateRevenueProjectionInput = {
  projectedAdr: Money;
  projectedOccupancy: Percentage;
  confidence: Percentage;
  availableNights?: number;
};

export function calculateRevenueProjection({
  projectedAdr,
  projectedOccupancy,
  confidence,
  availableNights = 365,
}: CalculateRevenueProjectionInput): RevenueProjection {
  assertMoney(
    projectedAdr,
    "Projected ADR",
  );

  assertFiniteNonNegative(
    availableNights,
    "Available nights",
  );

  if (!Number.isInteger(availableNights)) {
    throw new Error(
      "Available nights must be a whole number.",
    );
  }

  assertPercentage(
    projectedOccupancy,
    "Projected occupancy",
  );

  assertPercentage(
    confidence,
    "Confidence",
  );

  const occupiedNights =
    availableNights *
    (projectedOccupancy.value / 100);

  const projectedAnnualRevenue =
    roundCurrency(
      projectedAdr.amount * occupiedNights,
    );

  const projectedMonthlyRevenue =
    roundCurrency(
      projectedAnnualRevenue / 12,
    );

  return {
    projectedAdr,
    projectedOccupancy,
    projectedMonthlyRevenue: {
      amount: projectedMonthlyRevenue,
      currency: "USD",
    },
    projectedAnnualRevenue: {
      amount: projectedAnnualRevenue,
      currency: "USD",
    },
    confidence,
  };
}

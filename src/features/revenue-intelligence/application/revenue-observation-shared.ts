import type {
  ObservationUnitInput,
} from "@/platform/observations";

import {
  REVENUE_OBSERVATION_CAPABILITY,
} from "./revenue-observation-types";

export const REVENUE_OBSERVATION_SOURCE = {
  type: "feature",
  name: REVENUE_OBSERVATION_CAPABILITY,
} as const;

export const CURRENCY_UNIT:
  ObservationUnitInput = {
    type: "currency",
    symbol: "USD",
  };

export const CURRENCY_PER_NIGHT_UNIT:
  ObservationUnitInput = {
    type: "currency-per-night",
    symbol: "USD",
  };

export const PERCENTAGE_UNIT:
  ObservationUnitInput = {
    type: "percentage",
  };

export const NIGHTS_UNIT:
  ObservationUnitInput = {
    type: "nights",
  };

export const DAYS_UNIT:
  ObservationUnitInput = {
    type: "days",
  };

export const COUNT_UNIT:
  ObservationUnitInput = {
    type: "count",
  };

export function parseRevenueObservationDate(
  value: string,
  field: string,
): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(
      `${field} must be a valid date string.`,
    );
  }

  return date;
}

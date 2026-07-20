import type {
  ObservationSubjectInput,
  ObservationUnitInput,
} from "@/platform/observations";

import type {
  ComparableSubject,
} from "../../domain/entities/comparable-subject";

import {
  MARKET_OBSERVATION_CAPABILITY,
} from "./market-observation-types";

export const MARKET_OBSERVATION_SOURCE = {
  type: "feature",
  name: MARKET_OBSERVATION_CAPABILITY,
} as const;

export const CURRENCY_UNIT:
  ObservationUnitInput = {
    type: "currency",
    symbol: "USD",
  };

export const PERCENTAGE_UNIT:
  ObservationUnitInput = {
    type: "percentage",
  };

export const RATIO_UNIT:
  ObservationUnitInput = {
    type: "ratio",
  };

export const COUNT_UNIT:
  ObservationUnitInput = {
    type: "count",
  };

export function createMarketObservationSubject(
  subject: ComparableSubject,
): ObservationSubjectInput {
  return {
    type: "property",
    id:
      subject.id ??
      normalizeSubjectId(subject.address),
  };
}

export function normalizeSubjectId(
  value: string,
): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "market-subject";
}

import type {
  ObservationSubjectInput,
  ObservationUnitInput,
} from "@/platform/observations";

import type {
  InvestmentDecision,
} from "../../domain/investment-decision";

import {
  INVESTMENT_OBSERVATION_CAPABILITY,
} from "./investment-observation-types";

export const INVESTMENT_OBSERVATION_SOURCE = {
  type: "feature",
  name: INVESTMENT_OBSERVATION_CAPABILITY,
} as const;

export const INVESTMENT_CURRENCY_UNIT:
  ObservationUnitInput = {
    type: "currency",
    symbol: "USD",
  };

export const INVESTMENT_PERCENTAGE_UNIT:
  ObservationUnitInput = {
    type: "percentage",
  };

export const INVESTMENT_RATIO_UNIT:
  ObservationUnitInput = {
    type: "ratio",
  };

export const INVESTMENT_SCORE_UNIT:
  ObservationUnitInput = {
    type: "score",
    symbol: "/100",
  };

export const INVESTMENT_COUNT_UNIT:
  ObservationUnitInput = {
    type: "count",
  };

export const INVESTMENT_MONTHS_UNIT:
  ObservationUnitInput = {
    type: "duration",
    symbol: "months",
  };

export const INVESTMENT_SQUARE_FEET_UNIT:
  ObservationUnitInput = {
    type: "area",
    symbol: "sq ft",
  };

export function createInvestmentObservationSubject(
  decision: InvestmentDecision,
): ObservationSubjectInput {
  return {
    type: "property",
    id: decision.property.id,
  };
}

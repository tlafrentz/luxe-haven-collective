import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  PropertyPerformance,
} from "../types";

import {
  CURRENCY_PER_NIGHT_UNIT,
  CURRENCY_UNIT,
  REVENUE_OBSERVATION_SOURCE,
} from "./revenue-observation-shared";
import {
  REVENUE_OBSERVATION_TYPES,
  type RevenueObservationType,
} from "./revenue-observation-types";

export function mapRevenuePerformance(
  performance: PropertyPerformance,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createPerformanceSubject(performance);

  return [
    buildRevenueObservation({
      type:
        REVENUE_OBSERVATION_TYPES.grossRevenue,
      label: "Gross revenue",
      value: performance.revenue.grossRevenue,
      subject,
      recordedAt,
      unit: CURRENCY_UNIT,
    }),
    buildRevenueObservation({
      type:
        REVENUE_OBSERVATION_TYPES.roomRevenue,
      label: "Room revenue",
      value: performance.revenue.roomRevenue,
      subject,
      recordedAt,
      unit: CURRENCY_UNIT,
    }),
    buildRevenueObservation({
      type:
        REVENUE_OBSERVATION_TYPES.averageDailyRate,
      label: "Average daily rate",
      value:
        performance.revenue.averageDailyRate,
      subject,
      recordedAt,
      unit: CURRENCY_PER_NIGHT_UNIT,
    }),
    buildRevenueObservation({
      type:
        REVENUE_OBSERVATION_TYPES
          .revenuePerAvailableRoom,
      label: "Revenue per available room",
      value: performance.revenue.revPar,
      subject,
      recordedAt,
      unit: CURRENCY_PER_NIGHT_UNIT,
    }),
  ];
}

function buildRevenueObservation({
  type,
  label,
  value,
  subject,
  recordedAt,
  unit,
}: {
  type: RevenueObservationType;
  label: string;
  value: number;
  subject: {
    type: string;
    id: string;
  };
  recordedAt: Date;
  unit: {
    type: string;
    symbol?: string;
  };
}): AnyObservation {
  return ObservationBuilder.create()
    .withType(type)
    .concerning(subject)
    .withLabel(label)
    .withValue(value)
    .fromSource(REVENUE_OBSERVATION_SOURCE)
    .observedAt(recordedAt)
    .recordedAt(recordedAt)
    .measuredIn(unit)
    .withProvenance({
      retrievedAt: recordedAt,
      effectiveAt: recordedAt,
      notes:
        "Mapped from the current revenue intelligence performance snapshot.",
    })
    .build();
}

function createPerformanceSubject(
  performance: PropertyPerformance,
): {
  type: string;
  id: string;
} {
  if (performance.scope.type === "property") {
    return {
      type: "property",
      id: performance.scope.propertyId,
    };
  }

  return {
    type: "portfolio",
    id: "portfolio",
  };
}

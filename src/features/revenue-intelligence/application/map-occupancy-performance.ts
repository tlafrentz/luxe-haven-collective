import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  PropertyPerformance,
} from "../types";

import {
  NIGHTS_UNIT,
  PERCENTAGE_UNIT,
  REVENUE_OBSERVATION_SOURCE,
} from "./revenue-observation-shared";
import {
  REVENUE_OBSERVATION_TYPES,
  type RevenueObservationType,
} from "./revenue-observation-types";

export function mapOccupancyPerformance(
  performance: PropertyPerformance,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createPerformanceSubject(performance);

  return [
    buildOccupancyObservation({
      type:
        REVENUE_OBSERVATION_TYPES.occupiedNights,
      label: "Occupied nights",
      value:
        performance.occupancy.occupiedNights,
      subject,
      recordedAt,
      unit: NIGHTS_UNIT,
    }),
    buildOccupancyObservation({
      type:
        REVENUE_OBSERVATION_TYPES.availableNights,
      label: "Available nights",
      value:
        performance.occupancy.availableNights,
      subject,
      recordedAt,
      unit: NIGHTS_UNIT,
    }),
    buildOccupancyObservation({
      type:
        REVENUE_OBSERVATION_TYPES.occupancyRate,
      label: "Occupancy rate",
      value:
        performance.occupancy.occupancyRate,
      subject,
      recordedAt,
      unit: PERCENTAGE_UNIT,
    }),
  ];
}

function buildOccupancyObservation({
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

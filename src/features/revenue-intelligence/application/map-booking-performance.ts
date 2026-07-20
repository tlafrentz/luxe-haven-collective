import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  PropertyPerformance,
} from "../types";

import {
  COUNT_UNIT,
  DAYS_UNIT,
  NIGHTS_UNIT,
  PERCENTAGE_UNIT,
  REVENUE_OBSERVATION_SOURCE,
} from "./revenue-observation-shared";
import {
  REVENUE_OBSERVATION_TYPES,
  type RevenueObservationType,
} from "./revenue-observation-types";

export function mapBookingPerformance(
  performance: PropertyPerformance,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createPerformanceSubject(performance);

  return [
    buildBookingObservation({
      type:
        REVENUE_OBSERVATION_TYPES.totalBookings,
      label: "Total bookings",
      value:
        performance.bookings.totalBookings,
      subject,
      recordedAt,
      unit: COUNT_UNIT,
    }),
    buildBookingObservation({
      type:
        REVENUE_OBSERVATION_TYPES
          .upcomingBookings,
      label: "Upcoming bookings",
      value:
        performance.bookings.upcomingBookings,
      subject,
      recordedAt,
      unit: COUNT_UNIT,
    }),
    buildBookingObservation({
      type:
        REVENUE_OBSERVATION_TYPES
          .completedBookings,
      label: "Completed bookings",
      value:
        performance.bookings.completedBookings,
      subject,
      recordedAt,
      unit: COUNT_UNIT,
    }),
    buildBookingObservation({
      type:
        REVENUE_OBSERVATION_TYPES
          .cancelledBookings,
      label: "Cancelled bookings",
      value:
        performance.bookings.cancelledBookings,
      subject,
      recordedAt,
      unit: COUNT_UNIT,
    }),
    buildBookingObservation({
      type:
        REVENUE_OBSERVATION_TYPES
          .cancellationRate,
      label: "Cancellation rate",
      value:
        performance.bookings.cancellationRate,
      subject,
      recordedAt,
      unit: PERCENTAGE_UNIT,
    }),
    buildBookingObservation({
      type:
        REVENUE_OBSERVATION_TYPES
          .averageBookingLeadTime,
      label: "Average booking lead time",
      value:
        performance.bookings
          .averageBookingLeadTime,
      subject,
      recordedAt,
      unit: DAYS_UNIT,
    }),
    buildBookingObservation({
      type:
        REVENUE_OBSERVATION_TYPES
          .averageLengthOfStay,
      label: "Average length of stay",
      value:
        performance.bookings.averageLengthOfStay,
      subject,
      recordedAt,
      unit: NIGHTS_UNIT,
    }),
  ];
}

function buildBookingObservation({
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

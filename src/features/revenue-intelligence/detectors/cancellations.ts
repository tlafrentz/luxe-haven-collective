import type {
  OpportunityConfidence,
  OpportunityDetectionContext,
  OpportunityDetector,
  OpportunitySeverity,
  PropertyPerformance,
  RevenueOpportunity,
} from "../types";

const DETECTOR_ID = "cancellations";

const MINIMUM_RESOLVED_BOOKINGS = 4;
const MINIMUM_CANCELLATION_RATE = 15;
const HIGH_CANCELLATION_RATE = 30;
const ABSOLUTE_RISK_RATE = 25;
const MINIMUM_RATE_INCREASE = 5;
const HIGH_RATE_INCREASE = 15;

function getResolvedBookingCount(
  performance: PropertyPerformance,
): number {
  return (
    performance.bookings.totalBookings +
    performance.bookings.cancelledBookings
  );
}

function getRateDifference({
  currentRate,
  previousRate,
}: {
  currentRate: number;
  previousRate: number;
}): number {
  return Math.round(
    (currentRate - previousRate + Number.EPSILON) *
      10,
  ) / 10;
}

function getConfidence(
  resolvedBookingCount: number,
): OpportunityConfidence {
  if (resolvedBookingCount >= 15) {
    return "high";
  }

  if (resolvedBookingCount >= 8) {
    return "medium";
  }

  return "low";
}

function getSeverity({
  currentRate,
  rateDifference,
}: {
  currentRate: number;
  rateDifference: number;
}): OpportunitySeverity {
  if (
    currentRate >= HIGH_CANCELLATION_RATE ||
    rateDifference >= HIGH_RATE_INCREASE
  ) {
    return "high";
  }

  return "medium";
}

function shouldCreateOpportunity({
  currentRate,
  rateDifference,
  resolvedBookingCount,
}: {
  currentRate: number;
  rateDifference: number;
  resolvedBookingCount: number;
}): boolean {
  if (
    resolvedBookingCount <
    MINIMUM_RESOLVED_BOOKINGS
  ) {
    return false;
  }

  if (
    currentRate < MINIMUM_CANCELLATION_RATE
  ) {
    return false;
  }

  return (
    rateDifference >= MINIMUM_RATE_INCREASE ||
    currentRate >= ABSOLUTE_RISK_RATE
  );
}

function createOpportunityId(
  propertyId: string | null,
): string {
  return [
    DETECTOR_ID,
    "elevated-cancellation-rate",
    propertyId ?? "portfolio",
  ].join(":");
}

function createCancellationOpportunity({
  context,
  currentRate,
  previousRate,
  rateDifference,
  resolvedBookingCount,
}: {
  context: OpportunityDetectionContext;
  currentRate: number;
  previousRate: number;
  rateDifference: number;
  resolvedBookingCount: number;
}): RevenueOpportunity {
  const propertyId =
    context.performance.scope.propertyId;

  const cancelledBookings =
    context.performance.bookings
      .cancelledBookings;

  const directionSummary =
    rateDifference > 0
      ? `an increase of ${rateDifference.toFixed(
          1,
        )} percentage points`
      : "a persistently elevated level";

  return {
    id: createOpportunityId(propertyId),
    detectorId: DETECTOR_ID,
    type: "elevated-cancellation-rate",
    category: "operations",
    severity: getSeverity({
      currentRate,
      rateDifference,
    }),
    confidence: getConfidence(
      resolvedBookingCount,
    ),
    status: "open",
    propertyId,
    dateRange: {
      startDate:
        context.performance.period.startDate,
      endDate:
        context.performance.period.endDate,
    },
    detectedAt: context.detectedAt,
    title: "Cancellation rate requires review",
    summary:
      `The cancellation rate is ${currentRate.toFixed(
        1,
      )}%, representing ${directionSummary} compared with the previous period.`,
    evidence: [
      {
        key: "currentCancellationRate",
        label: "Current cancellation rate",
        value: currentRate,
        unit: "percentage",
      },
      {
        key: "previousCancellationRate",
        label: "Previous cancellation rate",
        value: previousRate,
        unit: "percentage",
      },
      {
        key: "cancellationRateDifference",
        label: "Rate change",
        value: rateDifference,
        unit: "percentage",
      },
      {
        key: "cancelledReservationCount",
        label: "Canceled reservations",
        value: cancelledBookings,
        unit: "count",
      },
      {
        key: "resolvedReservationCount",
        label: "Resolved reservations",
        value: resolvedBookingCount,
        unit: "count",
      },
    ],
    impact: {
      type: "operational-risk",
      basis:
        "Elevated cancellation behavior can increase vacant-night exposure, revenue volatility, and operating workload. No direct revenue amount is estimated without reservation-level cancellation values.",
    },
    action: {
      type: "review-cancellation-policy",
      summary:
        "Review cancellation timing, booking sources, rate restrictions, and policy settings to identify the primary drivers of cancellations.",
      parameters: {
        currentCancellationRate:
          currentRate,
        previousCancellationRate:
          previousRate,
        cancelledReservationCount:
          cancelledBookings,
      },
    },
  };
}

export const cancellationsOpportunityDetector: OpportunityDetector =
  {
    id: DETECTOR_ID,
    opportunityTypes: [
      "elevated-cancellation-rate",
    ],
    detect(
      context: OpportunityDetectionContext,
    ): RevenueOpportunity[] {
      const currentRate =
        context.performance.bookings
          .cancellationRate;

      const previousRate =
        context.previousPerformance?.bookings
          .cancellationRate ?? 0;

      const resolvedBookingCount =
        getResolvedBookingCount(
          context.performance,
        );

      const rateDifference =
        getRateDifference({
          currentRate,
          previousRate,
        });

      if (
        !shouldCreateOpportunity({
          currentRate,
          rateDifference,
          resolvedBookingCount,
        })
      ) {
        return [];
      }

      return [
        createCancellationOpportunity({
          context,
          currentRate,
          previousRate,
          rateDifference,
          resolvedBookingCount,
        }),
      ];
    },
  };

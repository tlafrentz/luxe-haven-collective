import type {
  OccupancyDataPoint,
} from "../domain/revenue-input";

import type {
  OpportunityConfidence,
  OpportunityDetectionContext,
  OpportunityDetector,
  OpportunitySeverity,
  RevenueOpportunity,
} from "../types";

const DETECTOR_ID = "low-weekday-occupancy";

const MINIMUM_WEEKDAY_AVAILABLE_NIGHTS = 10;
const LOW_WEEKDAY_OCCUPANCY_THRESHOLD = 45;
const VERY_LOW_WEEKDAY_OCCUPANCY_THRESHOLD = 30;
const CRITICAL_WEEKDAY_OCCUPANCY_THRESHOLD = 25;
const MINIMUM_WEEKEND_GAP = 20;
const HIGH_WEEKEND_GAP = 40;

type OccupancySegment = {
  availableNights: number;
  occupiedNights: number;
  occupancyRate: number;
};

type WeekdayOccupancySummary = {
  weekday: OccupancySegment;
  weekend: OccupancySegment;
  occupancyGap: number;
};

function roundMetric(value: number): number {
  return Math.round(
    (value + Number.EPSILON) * 10,
  ) / 10;
}

function getUtcDay(date: string): number {
  return new Date(
    `${date}T00:00:00.000Z`,
  ).getUTCDay();
}

function isWeekend(date: string): boolean {
  const day = getUtcDay(date);

  return day === 5 || day === 6;
}

function calculateOccupancyRate({
  occupiedNights,
  availableNights,
}: {
  occupiedNights: number;
  availableNights: number;
}): number {
  if (availableNights === 0) {
    return 0;
  }

  return roundMetric(
    (occupiedNights / availableNights) * 100,
  );
}

function summarizeOccupancy(
  series: OccupancyDataPoint[],
): WeekdayOccupancySummary {
  let weekdayAvailableNights = 0;
  let weekdayOccupiedNights = 0;
  let weekendAvailableNights = 0;
  let weekendOccupiedNights = 0;

  for (const point of series) {
    if (isWeekend(point.date)) {
      weekendAvailableNights +=
        point.availableNights;
      weekendOccupiedNights +=
        point.occupiedNights;
    } else {
      weekdayAvailableNights +=
        point.availableNights;
      weekdayOccupiedNights +=
        point.occupiedNights;
    }
  }

  const weekdayOccupancyRate =
    calculateOccupancyRate({
      occupiedNights:
        weekdayOccupiedNights,
      availableNights:
        weekdayAvailableNights,
    });

  const weekendOccupancyRate =
    calculateOccupancyRate({
      occupiedNights:
        weekendOccupiedNights,
      availableNights:
        weekendAvailableNights,
    });

  return {
    weekday: {
      availableNights:
        weekdayAvailableNights,
      occupiedNights:
        weekdayOccupiedNights,
      occupancyRate:
        weekdayOccupancyRate,
    },
    weekend: {
      availableNights:
        weekendAvailableNights,
      occupiedNights:
        weekendOccupiedNights,
      occupancyRate:
        weekendOccupancyRate,
    },
    occupancyGap: roundMetric(
      weekendOccupancyRate -
        weekdayOccupancyRate,
    ),
  };
}

function shouldCreateOpportunity({
  weekdayAvailableNights,
  weekdayOccupancyRate,
  occupancyGap,
}: {
  weekdayAvailableNights: number;
  weekdayOccupancyRate: number;
  occupancyGap: number;
}): boolean {
  if (
    weekdayAvailableNights <
    MINIMUM_WEEKDAY_AVAILABLE_NIGHTS
  ) {
    return false;
  }

  if (
    weekdayOccupancyRate >=
    LOW_WEEKDAY_OCCUPANCY_THRESHOLD
  ) {
    return false;
  }

  return (
    weekdayOccupancyRate <
      VERY_LOW_WEEKDAY_OCCUPANCY_THRESHOLD ||
    occupancyGap >= MINIMUM_WEEKEND_GAP
  );
}

function getSeverity({
  weekdayOccupancyRate,
  occupancyGap,
}: {
  weekdayOccupancyRate: number;
  occupancyGap: number;
}): OpportunitySeverity {
  if (
    weekdayOccupancyRate <
      CRITICAL_WEEKDAY_OCCUPANCY_THRESHOLD ||
    occupancyGap >= HIGH_WEEKEND_GAP
  ) {
    return "high";
  }

  return "medium";
}

function getConfidence(
  weekdayAvailableNights: number,
): OpportunityConfidence {
  if (weekdayAvailableNights >= 40) {
    return "high";
  }

  if (weekdayAvailableNights >= 20) {
    return "medium";
  }

  return "low";
}

function createOpportunityId(
  propertyId: string | null,
): string {
  return [
    DETECTOR_ID,
    "low-weekday-occupancy",
    propertyId ?? "portfolio",
  ].join(":");
}

function createOpportunity({
  context,
  summary,
}: {
  context: OpportunityDetectionContext;
  summary: WeekdayOccupancySummary;
}): RevenueOpportunity {
  const propertyId =
    context.performance.scope.propertyId;

  return {
    id: createOpportunityId(propertyId),
    detectorId: DETECTOR_ID,
    type: "low-weekday-occupancy",
    category: "occupancy",
    severity: getSeverity({
      weekdayOccupancyRate:
        summary.weekday.occupancyRate,
      occupancyGap: summary.occupancyGap,
    }),
    confidence: getConfidence(
      summary.weekday.availableNights,
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
    title: "Weekday occupancy is underperforming",
    summary:
      `Sunday-through-Thursday occupancy is ${summary.weekday.occupancyRate.toFixed(
        1,
      )}%, compared with ${summary.weekend.occupancyRate.toFixed(
        1,
      )}% on Friday and Saturday nights.`,
    evidence: [
      {
        key: "weekdayOccupancyRate",
        label: "Weekday occupancy",
        value:
          summary.weekday.occupancyRate,
        unit: "percentage",
      },
      {
        key: "weekendOccupancyRate",
        label: "Weekend occupancy",
        value:
          summary.weekend.occupancyRate,
        unit: "percentage",
      },
      {
        key: "occupancyGap",
        label: "Weekend occupancy advantage",
        value: summary.occupancyGap,
        unit: "percentage",
      },
      {
        key: "weekdayAvailableNights",
        label: "Weekday nights analyzed",
        value:
          summary.weekday.availableNights,
        unit: "nights",
      },
      {
        key: "weekdayOccupiedNights",
        label: "Occupied weekday nights",
        value:
          summary.weekday.occupiedNights,
        unit: "nights",
      },
    ],
    impact: {
      type: "occupancy-increase",
      estimatedPercentage:
        Math.max(0, summary.occupancyGap),
      basis:
        "The estimated percentage represents the observed occupancy-rate difference between weekday and weekend inventory. It is a demand-gap indicator, not a guaranteed improvement.",
    },
    action: {
      type: "promote-availability",
      summary:
        "Review weekday pricing, minimum-stay rules, lead-time discounts, and targeted promotions to improve Sunday-through-Thursday demand.",
      parameters: {
        weekdayOccupancyRate:
          summary.weekday.occupancyRate,
        weekendOccupancyRate:
          summary.weekend.occupancyRate,
        occupancyGap:
          summary.occupancyGap,
      },
    },
  };
}

export const lowWeekdayOccupancyOpportunityDetector: OpportunityDetector =
  {
    id: DETECTOR_ID,
    opportunityTypes: [
      "low-weekday-occupancy",
    ],
    detect(
      context: OpportunityDetectionContext,
    ): RevenueOpportunity[] {
      if (
        !context.occupancySeries ||
        context.occupancySeries.length === 0
      ) {
        return [];
      }

      const summary = summarizeOccupancy(
        context.occupancySeries,
      );

      if (
        !shouldCreateOpportunity({
          weekdayAvailableNights:
            summary.weekday.availableNights,
          weekdayOccupancyRate:
            summary.weekday.occupancyRate,
          occupancyGap:
            summary.occupancyGap,
        })
      ) {
        return [];
      }

      return [
        createOpportunity({
          context,
          summary,
        }),
      ];
    },
  };

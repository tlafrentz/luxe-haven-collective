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

const DETECTOR_ID = "weekend-pricing";

const MINIMUM_WEEKEND_AVAILABLE_NIGHTS = 8;
const MINIMUM_WEEKEND_OCCUPIED_NIGHTS = 6;
const MINIMUM_WEEKEND_OCCUPANCY = 85;
const MINIMUM_OCCUPANCY_GAP = 15;

const HIGH_WEEKEND_OCCUPANCY = 95;
const STRONG_WEEKEND_OCCUPANCY = 90;
const HIGH_OCCUPANCY_GAP = 40;

type OccupancySegment = {
  availableNights: number;
  occupiedNights: number;
  occupancyRate: number;
};

type WeekendPricingSummary = {
  weekday: OccupancySegment;
  weekend: OccupancySegment;
  occupancyGap: number;
};

function roundMetric(value: number): number {
  return Math.round(
    (value + Number.EPSILON) * 10,
  ) / 10;
}

function roundCurrency(value: number): number {
  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100;
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
): WeekendPricingSummary {
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
  summary,
  averageDailyRate,
}: {
  summary: WeekendPricingSummary;
  averageDailyRate: number;
}): boolean {
  return (
    summary.weekend.availableNights >=
      MINIMUM_WEEKEND_AVAILABLE_NIGHTS &&
    summary.weekend.occupiedNights >=
      MINIMUM_WEEKEND_OCCUPIED_NIGHTS &&
    summary.weekend.occupancyRate >=
      MINIMUM_WEEKEND_OCCUPANCY &&
    summary.occupancyGap >=
      MINIMUM_OCCUPANCY_GAP &&
    averageDailyRate > 0
  );
}

function getSuggestedIncreasePercent(
  weekendOccupancyRate: number,
): number {
  if (
    weekendOccupancyRate >=
    HIGH_WEEKEND_OCCUPANCY
  ) {
    return 10;
  }

  if (
    weekendOccupancyRate >=
    STRONG_WEEKEND_OCCUPANCY
  ) {
    return 8;
  }

  return 5;
}

function getSeverity({
  weekendOccupancyRate,
  occupancyGap,
}: {
  weekendOccupancyRate: number;
  occupancyGap: number;
}): OpportunitySeverity {
  if (
    weekendOccupancyRate >=
      HIGH_WEEKEND_OCCUPANCY ||
    occupancyGap >= HIGH_OCCUPANCY_GAP
  ) {
    return "high";
  }

  return "medium";
}

function getConfidence({
  weekendAvailableNights,
  weekendOccupiedNights,
}: {
  weekendAvailableNights: number;
  weekendOccupiedNights: number;
}): OpportunityConfidence {
  if (
    weekendAvailableNights >= 20 &&
    weekendOccupiedNights >= 15
  ) {
    return "high";
  }

  if (
    weekendAvailableNights >= 12 &&
    weekendOccupiedNights >= 8
  ) {
    return "medium";
  }

  return "low";
}

function createOpportunityId(
  propertyId: string | null,
): string {
  return [
    DETECTOR_ID,
    "underpriced-weekend",
    propertyId ?? "portfolio",
  ].join(":");
}

function createOpportunity({
  context,
  summary,
  averageDailyRate,
}: {
  context: OpportunityDetectionContext;
  summary: WeekendPricingSummary;
  averageDailyRate: number;
}): RevenueOpportunity {
  const propertyId =
    context.performance.scope.propertyId;

  const suggestedIncreasePercent =
    getSuggestedIncreasePercent(
      summary.weekend.occupancyRate,
    );

  const estimatedRevenueImpact =
    roundCurrency(
      summary.weekend.occupiedNights *
        averageDailyRate *
        (suggestedIncreasePercent / 100),
    );

  return {
    id: createOpportunityId(propertyId),
    detectorId: DETECTOR_ID,
    type: "underpriced-weekend",
    category: "pricing",
    severity: getSeverity({
      weekendOccupancyRate:
        summary.weekend.occupancyRate,
      occupancyGap:
        summary.occupancyGap,
    }),
    confidence: getConfidence({
      weekendAvailableNights:
        summary.weekend.availableNights,
      weekendOccupiedNights:
        summary.weekend.occupiedNights,
    }),
    status: "open",
    propertyId,
    dateRange: {
      startDate:
        context.performance.period.startDate,
      endDate:
        context.performance.period.endDate,
    },
    detectedAt: context.detectedAt,
    title:
      "Weekend demand may support higher rates",
    summary:
      `Friday and Saturday occupancy is ${summary.weekend.occupancyRate.toFixed(
        1,
      )}%, which is ${summary.occupancyGap.toFixed(
        1,
      )} percentage points above weekday occupancy.`,
    evidence: [
      {
        key: "weekendOccupancyRate",
        label: "Weekend occupancy",
        value:
          summary.weekend.occupancyRate,
        unit: "percentage",
      },
      {
        key: "weekdayOccupancyRate",
        label: "Weekday occupancy",
        value:
          summary.weekday.occupancyRate,
        unit: "percentage",
      },
      {
        key: "occupancyGap",
        label: "Weekend occupancy advantage",
        value: summary.occupancyGap,
        unit: "percentage",
      },
      {
        key: "weekendAvailableNights",
        label: "Weekend nights analyzed",
        value:
          summary.weekend.availableNights,
        unit: "nights",
      },
      {
        key: "weekendOccupiedNights",
        label: "Occupied weekend nights",
        value:
          summary.weekend.occupiedNights,
        unit: "nights",
      },
      {
        key: "averageDailyRate",
        label: "Current ADR",
        value: averageDailyRate,
        unit: "currency",
      },
      {
        key: "suggestedIncreasePercent",
        label: "Suggested test increase",
        value:
          suggestedIncreasePercent,
        unit: "percentage",
      },
    ],
    impact: {
      type: "revenue-increase",
      estimatedAmount:
        estimatedRevenueImpact,
      estimatedPercentage:
        suggestedIncreasePercent,
      currency: "USD",
      basis:
        "Occupied weekend nights multiplied by current ADR and the suggested rate increase. This assumes occupied volume remains constant and is not a guaranteed revenue result.",
    },
    action: {
      type: "increase-rate",
      summary:
        `Test a ${suggestedIncreasePercent}% increase on remaining Friday and Saturday inventory while monitoring booking pace.`,
      parameters: {
        suggestedIncreasePercent,
        currentAverageDailyRate:
          averageDailyRate,
        suggestedReferenceRate:
          roundCurrency(
            averageDailyRate *
              (1 +
                suggestedIncreasePercent /
                  100),
          ),
        weekendOccupancyRate:
          summary.weekend.occupancyRate,
        weekdayOccupancyRate:
          summary.weekday.occupancyRate,
      },
    },
  };
}

export const weekendPricingOpportunityDetector: OpportunityDetector =
  {
    id: DETECTOR_ID,
    opportunityTypes: [
      "underpriced-weekend",
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

      const averageDailyRate =
        context.performance.revenue
          .averageDailyRate;

      const summary = summarizeOccupancy(
        context.occupancySeries,
      );

      if (
        !shouldCreateOpportunity({
          summary,
          averageDailyRate,
        })
      ) {
        return [];
      }

      return [
        createOpportunity({
          context,
          summary,
          averageDailyRate,
        }),
      ];
    },
  };

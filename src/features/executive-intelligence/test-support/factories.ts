import type {
  AnalyticsProperty,
  MetricTrend,
  OccupancyDataPoint,
} from "@/features/analytics";

import type {
  HpmPerformanceReport,
} from "@/features/hpm";

import type {
  RevenueIntelligence,
  RevenueOpportunity,
} from "@/features/revenue-intelligence";

import {
  createAnalyticsBooking,
  createOpportunity,
  createPropertyPerformance,
} from "@/features/revenue-intelligence/test-support/factories";

import type {
  ExecutivePriority,
  PortfolioSnapshot,
  RevenueRiskSummary,
} from "../domain";

function createMetricTrend(
  overrides: Partial<MetricTrend> = {},
): MetricTrend {
  return {
    difference: 0,
    percentChange: 0,
    direction: "neutral",
    ...overrides,
  };
}

export function createRevenueIntelligence(
  overrides: {
    opportunities?: RevenueOpportunity[];
    properties?: AnalyticsProperty[];
    selectedProperty?: AnalyticsProperty | null;
    occupancySeries?: OccupancyDataPoint[];
    generatedAt?: string;
  } = {},
): RevenueIntelligence {
  const opportunities =
    overrides.opportunities ?? [];

  const current =
    createPropertyPerformance();

  const previous =
    createPropertyPerformance({
      period: {
        startDate: "2026-06-01",
        endDate: "2026-07-01",
      },
    });

  const estimatedRevenueImpact =
    opportunities.reduce(
      (total, opportunity) =>
        total +
        (opportunity.impact?.estimatedAmount ?? 0),
      0,
    );

  return {
    report: {
      current,
      previous,
      comparison: {
        grossRevenue: createMetricTrend(),
        roomRevenue: createMetricTrend(),
        occupancyRate: createMetricTrend(),
        averageDailyRate: createMetricTrend(),
        revPar: createMetricTrend(),
        averageLengthOfStay:
          createMetricTrend(),
        averageBookingLeadTime:
          createMetricTrend(),
        cancellationRate:
          createMetricTrend(),
      },
      properties:
        overrides.properties ?? [
          {
            id: "property-1",
            name: "Mesa Downtown Retreat",
          },
        ],
      selectedProperty:
        overrides.selectedProperty ===
        undefined
          ? {
              id: "property-1",
              name: "Mesa Downtown Retreat",
            }
          : overrides.selectedProperty,
      dateRange: {
        startDate: "2026-07-01",
        endDate: "2026-08-01",
      },
      previousDateRange: {
        startDate: "2026-06-01",
        endDate: "2026-07-01",
      },
    },
    opportunityReport: {
      opportunities,
      summary: {
        total: opportunities.length,
        highPriority:
          opportunities.filter(
            (opportunity) =>
              opportunity.severity === "high",
          ).length,
        mediumPriority:
          opportunities.filter(
            (opportunity) =>
              opportunity.severity ===
              "medium",
          ).length,
        lowPriority:
          opportunities.filter(
            (opportunity) =>
              opportunity.severity === "low",
          ).length,
        estimatedRevenueImpact,
        currency: "USD",
        byCategory: {
          pricing: opportunities.filter(
            (opportunity) =>
              opportunity.category ===
              "pricing",
          ).length,
          occupancy: opportunities.filter(
            (opportunity) =>
              opportunity.category ===
              "occupancy",
          ).length,
          revenue: opportunities.filter(
            (opportunity) =>
              opportunity.category ===
              "revenue",
          ).length,
          distribution:
            opportunities.filter(
              (opportunity) =>
                opportunity.category ===
                "distribution",
            ).length,
          operations: opportunities.filter(
            (opportunity) =>
              opportunity.category ===
              "operations",
          ).length,
        },
        bySeverity: {
          high: opportunities.filter(
            (opportunity) =>
              opportunity.severity === "high",
          ).length,
          medium: opportunities.filter(
            (opportunity) =>
              opportunity.severity ===
              "medium",
          ).length,
          low: opportunities.filter(
            (opportunity) =>
              opportunity.severity === "low",
          ).length,
        },
      },
      generatedAt:
        overrides.generatedAt ??
        "2026-07-13T15:00:00.000Z",
    },
    bookings: [
      createAnalyticsBooking(),
    ],
    occupancySeries:
      overrides.occupancySeries ?? [],
    generatedAt:
      overrides.generatedAt ??
      "2026-07-13T15:00:00.000Z",
  };
}

export function createHpmPerformanceReport(
  overrides: Partial<HpmPerformanceReport> = {},
): HpmPerformanceReport {
  const report: HpmPerformanceReport = {
    scope: {
      type: "property",
      propertyId: "property-1",
      propertyCount: 1,
    },
    overall: {
      score: null,
      healthStatus: "unavailable",
      measurementStatus: "partial",
      confidence: null,
      change: null,
    },
    pillars: {
      investment: {
        pillar: "investment",
        measurementStatus: "unavailable",
        score: null,
        healthStatus: "unavailable",
        confidence: null,
        change: null,
        contributors: [],
      },
      financial: {
        pillar: "financial",
        measurementStatus: "unavailable",
        score: null,
        healthStatus: "unavailable",
        confidence: null,
        change: null,
        contributors: [],
      },
      revenue: {
        pillar: "revenue",
        measurementStatus: "measured",
        score: 78,
        healthStatus: "healthy",
        confidence: 85,
        change: {
          difference: 5,
          direction: "up",
        },
        contributors: [],
      },
      operations: {
        pillar: "operations",
        measurementStatus: "unavailable",
        score: null,
        healthStatus: "unavailable",
        confidence: null,
        change: null,
        contributors: [],
      },
      "guest-experience": {
        pillar: "guest-experience",
        measurementStatus: "unavailable",
        score: null,
        healthStatus: "unavailable",
        confidence: null,
        change: null,
        contributors: [],
      },
      risk: {
        pillar: "risk",
        measurementStatus: "partial",
        score: 82,
        healthStatus: "healthy",
        confidence: 55,
        change: null,
        contributors: [],
      },
      growth: {
        pillar: "growth",
        measurementStatus: "unavailable",
        score: null,
        healthStatus: "unavailable",
        confidence: null,
        change: null,
        contributors: [],
      },
    },
    dataCoverage: {
      measuredPillars: ["revenue"],
      partialPillars: ["risk"],
      unavailablePillars: [
        "investment",
        "financial",
        "operations",
        "guest-experience",
        "growth",
      ],
      measuredPillarCount: 1,
      totalPillarCount: 7,
      coveragePercentage: 21,
    },
    generatedAt:
      "2026-07-13T15:00:00.000Z",
  };

  return {
    ...report,
    ...overrides,
  };
}

export function createPortfolioSnapshot(
  overrides: Partial<PortfolioSnapshot> = {},
): PortfolioSnapshot {
  const neutralTrend = createMetricTrend();

  return {
    propertyCount: 1,
    grossRevenue: {
      value: 3000,
      trend: neutralTrend,
    },
    roomRevenue: {
      value: 2400,
      trend: neutralTrend,
    },
    occupancyRate: {
      value: 51.6,
      trend: neutralTrend,
    },
    averageDailyRate: {
      value: 150,
      trend: neutralTrend,
    },
    revPar: {
      value: 77.42,
      trend: neutralTrend,
    },
    totalBookings: 5,
    upcomingBookings: 3,
    cancelledBookings: 0,
    ...overrides,
  };
}

export function createRevenueRiskSummary(
  overrides: Partial<RevenueRiskSummary> = {},
): RevenueRiskSummary {
  return {
    totalEstimatedAmount: 0,
    currency: "USD",
    itemCount: 0,
    items: [],
    ...overrides,
  };
}

export function createExecutivePriority(
  overrides: Partial<ExecutivePriority> = {},
): ExecutivePriority {
  const opportunity = createOpportunity();

  return {
    id: "executive-priority-1",
    rank: 1,
    source: "revenue-intelligence",
    sourceId: opportunity.id,
    pillar: "revenue",
    propertyId: "property-1",
    status: "open",
    severity: "high",
    confidence: "high",
    title: "Increase weekday occupancy",
    summary:
      "Weekday occupancy is below the target.",
    rationale:
      "Weekday occupancy: 42%",
    impact: {
      type: "revenue-increase",
      estimatedAmount: 600,
      currency: "USD",
      basis: "Estimated available demand.",
    },
    action: {
      type: "decrease-rate",
      summary:
        "Reduce weekday pricing by 8%.",
    },
    detectedAt:
      "2026-07-13T15:00:00.000Z",
    ...overrides,
  };
}

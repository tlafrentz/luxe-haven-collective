import type {
  AnalyticsBooking,
  AnalyticsRecommendation,
  DashboardComparison,
  DashboardMetrics,
  OccupancyDataPoint,
} from "../types";

type GenerateRecommendationsParams = {
  metrics: DashboardMetrics;
  comparison: DashboardComparison;
  bookings: AnalyticsBooking[];
  occupancySeries: OccupancyDataPoint[];
};

type OccupancySummary = {
  weekendRate: number;
  weekdayRate: number;
  weekendAvailableNights: number;
  weekdayAvailableNights: number;
  weekendOccupiedNights: number;
  weekdayOccupiedNights: number;
};

const MAX_RECOMMENDATIONS = 5;

function roundMetric(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

function formatPercentage(value: number): string {
  return `${roundMetric(value).toFixed(1)}%`;
}

function getUtcDay(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

function isWeekend(date: string): boolean {
  const day = getUtcDay(date);

  return day === 5 || day === 6;
}

function summarizeOccupancy(
  series: OccupancyDataPoint[],
): OccupancySummary {
  let weekendAvailableNights = 0;
  let weekdayAvailableNights = 0;
  let weekendOccupiedNights = 0;
  let weekdayOccupiedNights = 0;

  for (const point of series) {
    if (isWeekend(point.date)) {
      weekendAvailableNights += point.availableNights;
      weekendOccupiedNights += point.occupiedNights;
    } else {
      weekdayAvailableNights += point.availableNights;
      weekdayOccupiedNights += point.occupiedNights;
    }
  }

  const weekendRate =
    weekendAvailableNights > 0
      ? (weekendOccupiedNights /
          weekendAvailableNights) *
        100
      : 0;

  const weekdayRate =
    weekdayAvailableNights > 0
      ? (weekdayOccupiedNights /
          weekdayAvailableNights) *
        100
      : 0;

  return {
    weekendRate: roundMetric(weekendRate),
    weekdayRate: roundMetric(weekdayRate),
    weekendAvailableNights,
    weekdayAvailableNights,
    weekendOccupiedNights,
    weekdayOccupiedNights,
  };
}

function getConfidence({
  bookingCount,
  availableNights,
}: {
  bookingCount: number;
  availableNights: number;
}): "high" | "medium" | "low" {
  if (bookingCount >= 10 && availableNights >= 28) {
    return "high";
  }

  if (bookingCount >= 4 && availableNights >= 14) {
    return "medium";
  }

  return "low";
}

function getEstimatedWeekendRateImpact({
  weekendOccupiedNights,
  averageDailyRate,
  increasePercent,
}: {
  weekendOccupiedNights: number;
  averageDailyRate: number;
  increasePercent: number;
}): number {
  return (
    weekendOccupiedNights *
    averageDailyRate *
    (increasePercent / 100)
  );
}

function sortRecommendations(
  recommendations: AnalyticsRecommendation[],
): AnalyticsRecommendation[] {
  const priorityRank = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return [...recommendations].sort(
    (first, second) =>
      priorityRank[first.priority] -
      priorityRank[second.priority],
  );
}

export function generateAnalyticsRecommendations({
  metrics,
  comparison,
  bookings,
  occupancySeries,
}: GenerateRecommendationsParams): AnalyticsRecommendation[] {
  const recommendations: AnalyticsRecommendation[] = [];

  if (
    bookings.length === 0 ||
    metrics.availableNights === 0
  ) {
    return [
      {
        id: "insufficient-booking-data",
        priority: "low",
        category: "operations",
        confidence: "low",
        title: "More booking data is needed",
        description:
          "The selected reporting period does not contain enough reservation activity to generate reliable recommendations.",
        suggestedAction:
          "Expand the reporting period or select a property with more booking history.",
        evidence: [
          {
            label: "Bookings analyzed",
            value: bookings.length.toString(),
          },
          {
            label: "Available nights",
            value: metrics.availableNights.toString(),
          },
        ],
      },
    ];
  }

  const confidence = getConfidence({
    bookingCount: metrics.totalBookings,
    availableNights: metrics.availableNights,
  });

  const occupancySummary =
    summarizeOccupancy(occupancySeries);

  const authorizedBookings = bookings.filter(
    (booking) =>
      booking.status !== "cancelled" &&
      booking.paymentStatus === "authorized",
  );

  const unpaidBookings = bookings.filter(
    (booking) =>
      booking.status !== "cancelled" &&
      booking.paymentStatus === "unpaid",
  );

  if (authorizedBookings.length > 0) {
    recommendations.push({
      id: "capture-authorized-payments",
      priority: "high",
      category: "payments",
      confidence: "high",
      title: "Capture authorized payments",
      description: `${authorizedBookings.length} ${
        authorizedBookings.length === 1
          ? "reservation has"
          : "reservations have"
      } an authorized payment that has not yet been captured.`,
      suggestedAction:
        "Review the reservations and capture payment before the applicable check-in dates.",
      expectedImpact:
        "Reduce payment risk and improve cash collection.",
      evidence: [
        {
          label: "Authorized reservations",
          value: authorizedBookings.length.toString(),
        },
      ],
    });
  }

  if (unpaidBookings.length > 0) {
    recommendations.push({
      id: "resolve-unpaid-reservations",
      priority: "high",
      category: "payments",
      confidence: "high",
      title: "Resolve unpaid reservations",
      description: `${unpaidBookings.length} ${
        unpaidBookings.length === 1
          ? "reservation is"
          : "reservations are"
      } unpaid within the selected reporting period.`,
      suggestedAction:
        "Contact the guest or confirm that payment collection is scheduled before arrival.",
      expectedImpact:
        "Reduce the likelihood of unpaid stays or last-minute cancellations.",
      evidence: [
        {
          label: "Unpaid reservations",
          value: unpaidBookings.length.toString(),
        },
      ],
    });
  }

  if (
    occupancySummary.weekendRate >= 85 &&
    metrics.averageDailyRate > 0
  ) {
    const suggestedIncreasePercent =
      occupancySummary.weekendRate >= 95 ? 10 : 8;

    const estimatedImpact =
      getEstimatedWeekendRateImpact({
        weekendOccupiedNights:
          occupancySummary.weekendOccupiedNights,
        averageDailyRate: metrics.averageDailyRate,
        increasePercent: suggestedIncreasePercent,
      });

    recommendations.push({
      id: "increase-weekend-rates",
      priority: "high",
      category: "pricing",
      confidence,
      title: "Increase weekend pricing",
      description: `Weekend occupancy is ${formatPercentage(
        occupancySummary.weekendRate,
      )}, indicating strong demand for Friday and Saturday nights.`,
      suggestedAction: `Test a ${suggestedIncreasePercent}% increase on remaining weekend inventory.`,
      expectedImpact:
        estimatedImpact > 0
          ? `Approximately ${formatCurrency(
              estimatedImpact,
            )} in additional room revenue at current occupied volume.`
          : "Potentially improve weekend ADR without materially reducing occupancy.",
      evidence: [
        {
          label: "Weekend occupancy",
          value: formatPercentage(
            occupancySummary.weekendRate,
          ),
        },
        {
          label: "Current ADR",
          value: formatCurrency(
            metrics.averageDailyRate,
          ),
        },
        {
          label: "Weekend occupied nights",
          value:
            occupancySummary.weekendOccupiedNights.toString(),
        },
      ],
    });
  }

  if (
    occupancySummary.weekdayAvailableNights > 0 &&
    occupancySummary.weekdayRate < 50 &&
    occupancySummary.weekendRate -
      occupancySummary.weekdayRate >=
      20
  ) {
    recommendations.push({
      id: "improve-weekday-demand",
      priority: "medium",
      category: "occupancy",
      confidence,
      title: "Improve weekday occupancy",
      description: `Weekday occupancy is ${formatPercentage(
        occupancySummary.weekdayRate,
      )}, compared with ${formatPercentage(
        occupancySummary.weekendRate,
      )} on weekends.`,
      suggestedAction:
        "Test a weekday discount, business-travel offer, or extended-stay promotion for Sunday through Thursday nights.",
      expectedImpact:
        "Fill lower-demand nights while preserving stronger weekend pricing.",
      evidence: [
        {
          label: "Weekday occupancy",
          value: formatPercentage(
            occupancySummary.weekdayRate,
          ),
        },
        {
          label: "Weekend occupancy",
          value: formatPercentage(
            occupancySummary.weekendRate,
          ),
        },
        {
          label: "Occupancy gap",
          value: `${formatPercentage(
            occupancySummary.weekendRate -
              occupancySummary.weekdayRate,
          )} points`,
        },
      ],
    });
  }

  if (
    metrics.occupancyRate >= 85 &&
    comparison.adr.direction !== "up"
  ) {
    recommendations.push({
      id: "review-rate-ceiling",
      priority: "medium",
      category: "pricing",
      confidence,
      title: "Review your rate ceiling",
      description: `Occupancy is strong at ${formatPercentage(
        metrics.occupancyRate,
      )}, but ADR has not increased compared with the previous period.`,
      suggestedAction:
        "Increase rates incrementally on the highest-demand dates and monitor conversion.",
      expectedImpact:
        "Improve ADR and RevPAR while demand remains strong.",
      evidence: [
        {
          label: "Occupancy",
          value: formatPercentage(
            metrics.occupancyRate,
          ),
        },
        {
          label: "ADR change",
          value: formatCurrency(
            comparison.adr.difference,
          ),
        },
      ],
    });
  }

  if (
    comparison.revenue.direction === "down" &&
    Math.abs(comparison.revenue.percentChange) >= 10
  ) {
    recommendations.push({
      id: "address-revenue-decline",
      priority: "high",
      category: "revenue",
      confidence,
      title: "Investigate the revenue decline",
      description: `Gross revenue decreased ${formatPercentage(
        comparison.revenue.percentChange,
      )} compared with the previous period.`,
      suggestedAction:
        "Review whether the decline was driven by occupancy, ADR, cancellations, or a shorter reporting window.",
      expectedImpact:
        "Identify the primary revenue gap before changing pricing or promotions.",
      evidence: [
        {
          label: "Revenue change",
          value: formatPercentage(
            comparison.revenue.percentChange,
          ),
        },
        {
          label: "Revenue difference",
          value: formatCurrency(
            comparison.revenue.difference,
          ),
        },
        {
          label: "Occupancy change",
          value: formatPercentage(
            comparison.occupancy.percentChange,
          ),
        },
      ],
    });
  }

  if (
    comparison.adr.direction === "up" &&
    comparison.occupancy.direction !== "down"
  ) {
    recommendations.push({
      id: "maintain-pricing-strategy",
      priority: "low",
      category: "pricing",
      confidence,
      title: "Maintain the current pricing strategy",
      description: `ADR increased ${formatPercentage(
        comparison.adr.percentChange,
      )} without a corresponding occupancy decline.`,
      suggestedAction:
        "Keep current pricing rules in place and continue monitoring conversion.",
      expectedImpact:
        "Preserve improved rates while maintaining demand.",
      evidence: [
        {
          label: "ADR change",
          value: formatPercentage(
            comparison.adr.percentChange,
          ),
        },
        {
          label: "Occupancy change",
          value: formatPercentage(
            comparison.occupancy.percentChange,
          ),
        },
      ],
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "performance-stable",
      priority: "low",
      category: "operations",
      confidence,
      title: "Performance is stable",
      description:
        "The selected period does not show a strong pricing, occupancy, payment, or revenue issue.",
      suggestedAction:
        "Continue monitoring performance and expand the date range for stronger trend signals.",
      evidence: [
        {
          label: "Occupancy",
          value: formatPercentage(
            metrics.occupancyRate,
          ),
        },
        {
          label: "ADR",
          value: formatCurrency(
            metrics.averageDailyRate,
          ),
        },
        {
          label: "Bookings analyzed",
          value: metrics.totalBookings.toString(),
        },
      ],
    });
  }

  return sortRecommendations(
    recommendations,
  ).slice(0, MAX_RECOMMENDATIONS);
}

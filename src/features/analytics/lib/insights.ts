import type {
  AnalyticsBooking,
  DashboardComparison,
  DashboardMetrics,
  PerformanceInsight,
} from "../types";

function formatPercent(value: number): string {
  return `${Math.abs(value).toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

export function generatePerformanceInsights({
  metrics,
  comparison,
  bookings,
}: {
  metrics: DashboardMetrics;
  comparison: DashboardComparison;
  bookings: AnalyticsBooking[];
}): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];

  const revenueTrend = comparison.revenue;

  if (revenueTrend.direction === "up") {
    insights.push({
      id: "revenue-up",
      title: "Revenue increased",
      description: `Gross revenue is up ${formatPercent(
        revenueTrend.percentChange,
      )} compared with the previous period.`,
      tone: "positive",
    });
  } else if (revenueTrend.direction === "down") {
    insights.push({
      id: "revenue-down",
      title: "Revenue declined",
      description: `Gross revenue is down ${formatPercent(
        revenueTrend.percentChange,
      )} compared with the previous period.`,
      tone: "warning",
    });
  } else {
    insights.push({
      id: "revenue-flat",
      title: "Revenue is unchanged",
      description:
        "Gross revenue is consistent with the previous reporting period.",
      tone: "neutral",
    });
  }

  if (metrics.occupancyRate >= 85) {
    insights.push({
      id: "occupancy-high",
      title: "Occupancy is strong",
      description: `Occupancy is currently ${metrics.occupancyRate.toFixed(
        1,
      )}%. Consider reviewing rates for remaining available nights.`,
      tone: "positive",
    });
  } else if (metrics.occupancyRate >= 60) {
    insights.push({
      id: "occupancy-healthy",
      title: "Occupancy is healthy",
      description: `Occupancy is currently ${metrics.occupancyRate.toFixed(
        1,
      )}% for the selected period.`,
      tone: "informational",
    });
  } else {
    insights.push({
      id: "occupancy-low",
      title: "Occupancy has room to improve",
      description: `Occupancy is currently ${metrics.occupancyRate.toFixed(
        1,
      )}%. Pricing or listing optimization may help fill open nights.`,
      tone: "warning",
    });
  }

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
    insights.push({
      id: "authorized-payments",
      title: "Payments awaiting capture",
      description: `${authorizedBookings.length} ${
        authorizedBookings.length === 1
          ? "reservation has"
          : "reservations have"
      } an authorized payment that has not yet been captured.`,
      tone: "warning",
    });
  }

  if (unpaidBookings.length > 0) {
    insights.push({
      id: "unpaid-bookings",
      title: "Unpaid reservations need attention",
      description: `${unpaidBookings.length} ${
        unpaidBookings.length === 1
          ? "reservation is"
          : "reservations are"
      } currently unpaid.`,
      tone: "warning",
    });
  }

  if (
    comparison.adr.direction === "up" &&
    comparison.adr.difference > 0
  ) {
    insights.push({
      id: "adr-up",
      title: "Average rates improved",
      description: `ADR increased by ${formatCurrency(
        comparison.adr.difference,
      )} compared with the previous period.`,
      tone: "positive",
    });
  }

  return insights.slice(0, 4);
}

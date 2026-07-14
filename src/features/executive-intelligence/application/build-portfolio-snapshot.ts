import type {
  RevenueIntelligence,
} from "@/features/revenue-intelligence";

import type {
  PortfolioSnapshot,
} from "../domain";

export function buildPortfolioSnapshot(
  intelligence: RevenueIntelligence,
): PortfolioSnapshot {
  const {
    current,
    comparison,
  } = intelligence.report;

  return {
    propertyCount:
      current.scope.propertyCount,
    grossRevenue: {
      value: current.revenue.grossRevenue,
      trend: comparison.grossRevenue,
    },
    roomRevenue: {
      value: current.revenue.roomRevenue,
      trend: comparison.roomRevenue,
    },
    occupancyRate: {
      value:
        current.occupancy.occupancyRate,
      trend: comparison.occupancyRate,
    },
    averageDailyRate: {
      value:
        current.revenue.averageDailyRate,
      trend: comparison.averageDailyRate,
    },
    revPar: {
      value: current.revenue.revPar,
      trend: comparison.revPar,
    },
    totalBookings:
      current.bookings.totalBookings,
    upcomingBookings:
      current.bookings.upcomingBookings,
    cancelledBookings:
      current.bookings.cancelledBookings,
  };
}

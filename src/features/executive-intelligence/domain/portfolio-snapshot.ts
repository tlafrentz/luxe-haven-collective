import type {
  MetricTrend,
} from "@/features/analytics";

export type PortfolioSnapshotMetric = {
  value: number;
  trend: MetricTrend | null;
};

export type PortfolioSnapshot = {
  propertyCount: number;
  grossRevenue: PortfolioSnapshotMetric;
  roomRevenue: PortfolioSnapshotMetric;
  occupancyRate: PortfolioSnapshotMetric;
  averageDailyRate: PortfolioSnapshotMetric;
  revPar: PortfolioSnapshotMetric;
  totalBookings: number;
  upcomingBookings: number;
  cancelledBookings: number;
};

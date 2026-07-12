import type {
  AnalyticsRecommendation,
} from "./recommendations";

export const REVENUE_BOOKING_STATUSES = [
  "confirmed",
  "completed",
] as const;

export type RevenueBookingStatus =
  (typeof REVENUE_BOOKING_STATUSES)[number];

export type AnalyticsDateRange = {
  startDate: string;
  endDate: string;
};

export type AnalyticsQueryParams = AnalyticsDateRange & {
  propertyId?: string | null;
};

export type AnalyticsBooking = {
  id: string;
  propertyId: string;
  guestFullName: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  nightlyRate: number;
  cleaningFee: number;
  taxes: number;
  serviceFee: number;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  source: string | null;
  createdAt: string;
};

export type AnalyticsProperty = {
  id: string;
  name: string;
};

export type DashboardMetrics = {
  grossRevenue: number;
  roomRevenue: number;
  occupiedNights: number;
  availableNights: number;
  occupancyRate: number;
  averageDailyRate: number;
  revPar: number;
  averageLengthOfStay: number;
  totalBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
};

export type DashboardAnalytics = {
  metrics: DashboardMetrics;
  previousMetrics: DashboardMetrics;
  comparison: DashboardComparison;
  bookings: AnalyticsBooking[];
  properties: AnalyticsProperty[];
  dateRange: AnalyticsDateRange;
  previousDateRange: AnalyticsDateRange;
recommendations: AnalyticsRecommendation[];
  selectedPropertyId: string | null;
};

export type MetricTrendDirection =
  | "up"
  | "down"
  | "neutral";

export type MetricTrend = {
  difference: number;
  percentChange: number;
  direction: MetricTrendDirection;
};

export type DashboardComparison = {
  revenue: MetricTrend;
  occupancy: MetricTrend;
  adr: MetricTrend;
  revPar: MetricTrend;
};

export type InsightTone =
  | "positive"
  | "warning"
  | "informational"
  | "neutral";

export type PerformanceInsight = {
  id: string;
  title: string;
  description: string;
  tone: InsightTone;
};

export type RevenueDataPoint = {
  date: string;
  revenue: number;
};

export type OccupancyDataPoint = {
  date: string;
  occupiedNights: number;
  availableNights: number;
  occupancyRate: number;
};

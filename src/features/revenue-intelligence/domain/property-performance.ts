import type {
  AnalyticsDateRange,
  BookingSourceMetric,
  RevenueBreakdown,
  StayLengthBucket,
} from "@/features/analytics";

export type PerformanceScope =
  | {
      type: "property";
      propertyId: string;
      propertyCount: 1;
    }
  | {
      type: "portfolio";
      propertyId: null;
      propertyCount: number;
    };

export type RevenuePerformance = {
  grossRevenue: number;
  roomRevenue: number;
  averageDailyRate: number;
  revPar: number;
  breakdown: RevenueBreakdown;
};

export type OccupancyPerformance = {
  occupiedNights: number;
  availableNights: number;
  occupancyRate: number;
};

export type BookingPerformance = {
  totalBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  cancellationRate: number;
  averageBookingLeadTime: number;
  averageLengthOfStay: number;
};

export type BookingBehaviorPerformance = {
  sources: BookingSourceMetric[];
  stayLengthDistribution: StayLengthBucket[];
};

export type PropertyPerformance = {
  scope: PerformanceScope;
  period: AnalyticsDateRange;
  revenue: RevenuePerformance;
  occupancy: OccupancyPerformance;
  bookings: BookingPerformance;
  bookingBehavior: BookingBehaviorPerformance;
};


/** Revenue-owned normalized input contracts. Analytics persistence DTOs are adapted into these shapes. */
export type RevenueDateRange = { startDate: string; endDate: string };
export type RevenueQuery = RevenueDateRange & { propertyId?: string | null };
export type RevenueProperty = { id: string; name: string };
export type RevenueBooking = {
  id: string; propertyId: string; guestFullName: string | null; checkIn: string; checkOut: string; guests: number;
  nightlyRate: number; cleaningFee: number; taxes: number; serviceFee: number; totalAmount: number; status: string;
  paymentStatus: string; source: string | null; createdAt: string;
};
export type RevenueOccupancyPoint = { date: string; occupiedNights: number; availableNights: number; occupancyRate: number };
export type RevenueBreakdown = { roomRevenue: number; cleaningFees: number; taxes: number; serviceFees: number; otherRevenue: number; grossRevenue: number };
export type RevenueBookingSourceMetric = { source: string; bookingCount: number; bookingShare: number; occupiedNights: number; roomRevenue: number; averageDailyRate: number };
export type RevenueStayLengthBucket = { id: "one-night" | "two-nights" | "three-to-four-nights" | "five-to-seven-nights" | "eight-to-thirteen-nights" | "fourteen-to-twenty-nine-nights" | "thirty-plus-nights"; label: string; minimumNights: number; maximumNights: number | null; bookingCount: number; bookingShare: number; occupiedNights: number; roomRevenue: number };
export type RevenueMetricTrend = { difference: number; percentChange: number; direction: "up" | "down" | "neutral" };

/** @deprecated Transitional names retained for source compatibility; contracts are Revenue-owned. */
export type AnalyticsBooking = RevenueBooking;
export type AnalyticsDateRange = RevenueDateRange;
export type AnalyticsProperty = RevenueProperty;
export type AnalyticsQueryParams = RevenueQuery;
export type OccupancyDataPoint = RevenueOccupancyPoint;
export type BookingSourceMetric = RevenueBookingSourceMetric;
export type StayLengthBucket = RevenueStayLengthBucket;
export type MetricTrend = RevenueMetricTrend;

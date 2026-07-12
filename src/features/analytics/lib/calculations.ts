import {
  REVENUE_BOOKING_STATUSES,
  type AnalyticsBooking,
  type AnalyticsDateRange,
  type DashboardMetrics,
} from "../types";

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

function parseUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function differenceInNights(
  startDate: string,
  endDate: string,
): number {
  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);

  return Math.max(
    0,
    Math.round(
      (end.getTime() - start.getTime()) /
        MILLISECONDS_PER_DAY,
    ),
  );
}

export function getOverlappingNights(
  bookingCheckIn: string,
  bookingCheckOut: string,
  rangeStart: string,
  rangeEnd: string,
): number {
  const bookingStart = parseUtcDate(bookingCheckIn);
  const bookingEnd = parseUtcDate(bookingCheckOut);
  const reportingStart = parseUtcDate(rangeStart);
  const reportingEnd = parseUtcDate(rangeEnd);

  const overlapStart =
    bookingStart > reportingStart
      ? bookingStart
      : reportingStart;

  const overlapEnd =
    bookingEnd < reportingEnd
      ? bookingEnd
      : reportingEnd;

  if (overlapEnd <= overlapStart) {
    return 0;
  }

  return Math.round(
    (overlapEnd.getTime() - overlapStart.getTime()) /
      MILLISECONDS_PER_DAY,
  );
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundMetric(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function isRevenueBooking(booking: AnalyticsBooking): boolean {
  return REVENUE_BOOKING_STATUSES.some(
    (status) => status === booking.status,
  );
}

export function calculateDashboardMetrics({
  bookings,
  propertyCount,
  dateRange,
  today = new Date().toISOString().slice(0, 10),
}: {
  bookings: AnalyticsBooking[];
  propertyCount: number;
  dateRange: AnalyticsDateRange;
  today?: string;
}): DashboardMetrics {
  const revenueBookings = bookings.filter(isRevenueBooking);

  const reportingPeriodNights = differenceInNights(
    dateRange.startDate,
    dateRange.endDate,
  );

  const availableNights =
    reportingPeriodNights * propertyCount;

  let occupiedNights = 0;
  let roomRevenue = 0;
  let grossRevenue = 0;
  let totalStayNights = 0;

  for (const booking of revenueBookings) {
    const overlappingNights = getOverlappingNights(
      booking.checkIn,
      booking.checkOut,
      dateRange.startDate,
      dateRange.endDate,
    );

    const fullStayNights = differenceInNights(
      booking.checkIn,
      booking.checkOut,
    );

    occupiedNights += overlappingNights;
    totalStayNights += fullStayNights;

    roomRevenue += booking.nightlyRate * overlappingNights;

    /*
     * Gross booking revenue is recognized in the period
     * containing the booking's check-in date.
     */
    if (
      booking.checkIn >= dateRange.startDate &&
      booking.checkIn < dateRange.endDate
    ) {
      grossRevenue += booking.totalAmount;
    }
  }

  const occupancyRate =
    availableNights > 0
      ? (occupiedNights / availableNights) * 100
      : 0;

  const averageDailyRate =
    occupiedNights > 0
      ? roomRevenue / occupiedNights
      : 0;

  const revPar =
    availableNights > 0
      ? roomRevenue / availableNights
      : 0;

  const averageLengthOfStay =
    revenueBookings.length > 0
      ? totalStayNights / revenueBookings.length
      : 0;

  return {
    grossRevenue: roundCurrency(grossRevenue),
    roomRevenue: roundCurrency(roomRevenue),
    occupiedNights,
    availableNights,
    occupancyRate: roundMetric(occupancyRate),
    averageDailyRate: roundCurrency(averageDailyRate),
    revPar: roundCurrency(revPar),
    averageLengthOfStay: roundMetric(
      averageLengthOfStay,
    ),
    totalBookings: revenueBookings.length,
    upcomingBookings: revenueBookings.filter(
      (booking) => booking.checkIn >= today,
    ).length,
    completedBookings: bookings.filter(
      (booking) => booking.status === "completed",
    ).length,
    cancelledBookings: bookings.filter(
      (booking) => booking.status === "cancelled",
    ).length,
  };
}

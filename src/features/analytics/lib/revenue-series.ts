import {
  REVENUE_BOOKING_STATUSES,
  type AnalyticsBooking,
  type AnalyticsDateRange,
  type RevenueDataPoint,
} from "../types";

import { addDays } from "./date-range";
import { differenceInNights } from "./calculations";

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isRevenueBooking(
  booking: AnalyticsBooking,
): boolean {
  return REVENUE_BOOKING_STATUSES.some(
    (status) => status === booking.status,
  );
}

export function buildDailyRevenueSeries({
  bookings,
  dateRange,
}: {
  bookings: AnalyticsBooking[];
  dateRange: AnalyticsDateRange;
}): RevenueDataPoint[] {
  const revenueByDate = new Map<string, number>();

  /*
   * endDate is exclusive, so create one point for every
   * reporting night from startDate through endDate - 1.
   */
  for (
    let date = dateRange.startDate;
    date < dateRange.endDate;
    date = addDays(date, 1)
  ) {
    revenueByDate.set(date, 0);
  }

  for (const booking of bookings.filter(isRevenueBooking)) {
    const fullStayNights = differenceInNights(
      booking.checkIn,
      booking.checkOut,
    );

    if (fullStayNights === 0) {
      continue;
    }

    /*
     * Use the stored nightly rate for each occupied night.
     * Cleaning fees, taxes, and service fees are excluded
     * because this chart represents room revenue.
     */
    for (
      let stayDate = booking.checkIn;
      stayDate < booking.checkOut;
      stayDate = addDays(stayDate, 1)
    ) {
      if (
        stayDate < dateRange.startDate ||
        stayDate >= dateRange.endDate
      ) {
        continue;
      }

      const existingRevenue =
        revenueByDate.get(stayDate) ?? 0;

      revenueByDate.set(
        stayDate,
        existingRevenue + booking.nightlyRate,
      );
    }
  }

  return Array.from(revenueByDate.entries()).map(
    ([date, revenue]) => ({
      date,
      revenue: roundCurrency(revenue),
    }),
  );
}

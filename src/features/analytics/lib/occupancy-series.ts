import {
  REVENUE_BOOKING_STATUSES,
  type AnalyticsBooking,
  type AnalyticsDateRange,
  type OccupancyDataPoint,
} from "../types";

import { addDays } from "./date-range";

function isOccupancyBooking(
  booking: AnalyticsBooking,
): boolean {
  return REVENUE_BOOKING_STATUSES.some(
    (status) => status === booking.status,
  );
}

function roundPercentage(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function buildDailyOccupancySeries({
  bookings,
  dateRange,
  propertyCount,
}: {
  bookings: AnalyticsBooking[];
  dateRange: AnalyticsDateRange;
  propertyCount: number;
}): OccupancyDataPoint[] {
  const occupiedByDate = new Map<string, number>();

  for (
    let date = dateRange.startDate;
    date < dateRange.endDate;
    date = addDays(date, 1)
  ) {
    occupiedByDate.set(date, 0);
  }

  for (const booking of bookings.filter(isOccupancyBooking)) {
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

      const currentOccupied =
        occupiedByDate.get(stayDate) ?? 0;

      occupiedByDate.set(
        stayDate,
        currentOccupied + 1,
      );
    }
  }

  return Array.from(occupiedByDate.entries()).map(
    ([date, occupiedNights]) => {
      const availableNights = propertyCount;

      const occupancyRate =
        availableNights > 0
          ? (occupiedNights / availableNights) * 100
          : 0;

      return {
        date,
        occupiedNights,
        availableNights,
        occupancyRate: roundPercentage(occupancyRate),
      };
    },
  );
}

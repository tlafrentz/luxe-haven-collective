import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createAnalyticsBooking,
} from "../test-support/factories";

import {
  calculatePropertyPerformance,
} from "./calculate-property-performance";

describe("calculatePropertyPerformance", () => {
  it("projects analytics metrics into the canonical performance model", () => {
    const result =
      calculatePropertyPerformance({
        bookings: [
          createAnalyticsBooking({
            id: "booking-1",
            checkIn: "2026-07-05",
            checkOut: "2026-07-08",
            nightlyRate: 150,
            cleaningFee: 75,
            taxes: 30,
            serviceFee: 20,
            totalAmount: 575,
            source: "airbnb",
            createdAt:
              "2026-06-05T12:00:00.000Z",
          }),
          createAnalyticsBooking({
            id: "booking-2",
            checkIn: "2026-07-15",
            checkOut: "2026-07-20",
            nightlyRate: 200,
            cleaningFee: 100,
            taxes: 50,
            serviceFee: 25,
            totalAmount: 1175,
            source: "direct",
            createdAt:
              "2026-06-25T12:00:00.000Z",
          }),
        ],
        propertyCount: 1,
        propertyId: "property-1",
        dateRange: {
          startDate: "2026-07-01",
          endDate: "2026-08-01",
        },
        today: "2026-07-12",
      });

    expect(result.scope).toEqual({
      type: "property",
      propertyId: "property-1",
      propertyCount: 1,
    });

    expect(result.period).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-08-01",
    });

    expect(result.revenue).toMatchObject({
      grossRevenue: 1750,
      roomRevenue: 1450,
      averageDailyRate: 181.25,
      revPar: 46.77,
      breakdown: {
        roomRevenue: 1450,
        cleaningFees: 175,
        taxes: 80,
        serviceFees: 45,
        grossRevenue: 1750,
      },
    });

    expect(result.occupancy).toEqual({
      occupiedNights: 8,
      availableNights: 31,
      occupancyRate: 25.8,
    });

    expect(result.bookings).toMatchObject({
      totalBookings: 2,
      upcomingBookings: 1,
      completedBookings: 0,
      cancelledBookings: 0,
      cancellationRate: 0,
      averageBookingLeadTime: 25,
      averageLengthOfStay: 4,
    });

    expect(
      result.bookingBehavior.sources,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "airbnb",
          bookingCount: 1,
          bookingShare: 50,
          occupiedNights: 3,
          roomRevenue: 450,
          averageDailyRate: 150,
        }),
        expect.objectContaining({
          source: "direct",
          bookingCount: 1,
          bookingShare: 50,
          occupiedNights: 5,
          roomRevenue: 1000,
          averageDailyRate: 200,
        }),
      ]),
    );
  });

  it("creates portfolio scope when no property is selected", () => {
    const result =
      calculatePropertyPerformance({
        bookings: [],
        propertyCount: 3,
        propertyId: null,
        dateRange: {
          startDate: "2026-07-01",
          endDate: "2026-08-01",
        },
      });

    expect(result.scope).toEqual({
      type: "portfolio",
      propertyId: null,
      propertyCount: 3,
    });

    expect(result.occupancy).toEqual({
      occupiedNights: 0,
      availableNights: 93,
      occupancyRate: 0,
    });
  });

  it("forces property scope to one property", () => {
    const result =
      calculatePropertyPerformance({
        bookings: [],
        propertyCount: 5,
        propertyId: "property-1",
        dateRange: {
          startDate: "2026-07-01",
          endDate: "2026-08-01",
        },
      });

    expect(result.scope).toEqual({
      type: "property",
      propertyId: "property-1",
      propertyCount: 1,
    });

    expect(
      result.occupancy.availableNights,
    ).toBe(31);
  });

  it("includes cancellation and booking-behavior metrics", () => {
    const result =
      calculatePropertyPerformance({
        bookings: [
          createAnalyticsBooking({
            id: "confirmed",
            status: "confirmed",
            source: "airbnb",
          }),
          createAnalyticsBooking({
            id: "cancelled",
            status: "cancelled",
            source: "airbnb",
          }),
        ],
        propertyCount: 1,
        propertyId: "property-1",
        dateRange: {
          startDate: "2026-07-01",
          endDate: "2026-08-01",
        },
      });

    expect(result.bookings).toMatchObject({
      totalBookings: 1,
      cancelledBookings: 1,
      cancellationRate: 50,
    });

    expect(
      result.bookingBehavior.sources,
    ).toHaveLength(1);

    expect(
      result.bookingBehavior.sources[0],
    ).toMatchObject({
      source: "airbnb",
      bookingCount: 1,
      bookingShare: 100,
    });
  });

  it("returns stable zero values for an empty reporting period", () => {
    const result =
      calculatePropertyPerformance({
        bookings: [],
        propertyCount: 1,
        propertyId: "property-1",
        dateRange: {
          startDate: "2026-07-01",
          endDate: "2026-07-01",
        },
      });

    expect(result.revenue).toMatchObject({
      grossRevenue: 0,
      roomRevenue: 0,
      averageDailyRate: 0,
      revPar: 0,
    });

    expect(result.occupancy).toEqual({
      occupiedNights: 0,
      availableNights: 0,
      occupancyRate: 0,
    });

    expect(result.bookings).toMatchObject({
      totalBookings: 0,
      cancellationRate: 0,
      averageBookingLeadTime: 0,
      averageLengthOfStay: 0,
    });

    expect(
      result.bookingBehavior.sources,
    ).toEqual([]);
  });
});

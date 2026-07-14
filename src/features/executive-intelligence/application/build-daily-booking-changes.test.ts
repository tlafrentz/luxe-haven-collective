import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createAnalyticsBooking,
} from "@/features/revenue-intelligence/test-support/factories";

import {
  buildDailyBookingChanges,
} from "./build-daily-booking-changes";

describe("buildDailyBookingChanges", () => {
  it("creates reservation, arrival, and departure changes", () => {
    const result =
      buildDailyBookingChanges({
        createdToday: [
          createAnalyticsBooking({
            id: "created",
            guestFullName: "Alex Guest",
            createdAt:
              "2026-07-13T15:30:00.000Z",
            totalAmount: 800,
          }),
        ],
        arrivingToday: [
          createAnalyticsBooking({
            id: "arrival",
            guestFullName: "Jamie Arrival",
            checkIn: "2026-07-13",
          }),
        ],
        departingToday: [
          createAnalyticsBooking({
            id: "departure",
            guestFullName:
              "Morgan Departure",
            checkOut: "2026-07-13",
          }),
        ],
        localDate: "2026-07-13",
        generatedAt:
          "2026-07-13T16:00:00.000Z",
      });

    expect(result).toHaveLength(3);

    expect(
      result.map((change) => change.type),
    ).toEqual(
      expect.arrayContaining([
        "booking-created",
        "guest-arriving",
        "guest-departing",
      ]),
    );

    expect(
      result.find(
        (change) =>
          change.type ===
          "booking-created",
      ),
    ).toMatchObject({
      title: "New reservation created",
      propertyId: "property-1",
      value: 800,
      unit: "currency",
      currency: "USD",
    });
  });

  it("uses a neutral guest label when the guest name is unavailable", () => {
    const result =
      buildDailyBookingChanges({
        createdToday: [
          createAnalyticsBooking({
            id: "anonymous",
            guestFullName: null,
          }),
        ],
        arrivingToday: [],
        departingToday: [],
        localDate: "2026-07-13",
        generatedAt:
          "2026-07-13T16:00:00.000Z",
      });

    expect(result[0].description).toContain(
      "A guest booked",
    );
  });

  it("returns an empty array when there is no daily activity", () => {
    expect(
      buildDailyBookingChanges({
        createdToday: [],
        arrivingToday: [],
        departingToday: [],
        localDate: "2026-07-13",
        generatedAt:
          "2026-07-13T16:00:00.000Z",
      }),
    ).toEqual([]);
  });
});

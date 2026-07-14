import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createAnalyticsBooking,
} from "@/features/revenue-intelligence/test-support/factories";

import {
  filterBookingsCreatedOnLocalDate,
  getBroadUtcActivityWindow,
  getLocalDateString,
  isTimestampOnLocalDate,
} from "./daily-activity";

describe("daily activity date helpers", () => {
  it("resolves the Central-Time calendar date", () => {
    expect(
      getLocalDateString(
        new Date(
          "2026-07-14T02:30:00.000Z",
        ),
      ),
    ).toBe("2026-07-13");
  });

  it("matches timestamps that occur on the requested Central-Time date", () => {
    expect(
      isTimestampOnLocalDate({
        timestamp:
          "2026-07-14T02:30:00.000Z",
        localDate: "2026-07-13",
      }),
    ).toBe(true);

    expect(
      isTimestampOnLocalDate({
        timestamp:
          "2026-07-14T06:30:00.000Z",
        localDate: "2026-07-13",
      }),
    ).toBe(false);
  });

  it("filters bookings using the local calendar date rather than the UTC date", () => {
    const result =
      filterBookingsCreatedOnLocalDate({
        localDate: "2026-07-13",
        bookings: [
          createAnalyticsBooking({
            id: "included",
            createdAt:
              "2026-07-14T02:30:00.000Z",
          }),
          createAnalyticsBooking({
            id: "excluded",
            createdAt:
              "2026-07-14T06:30:00.000Z",
          }),
        ],
      });

    expect(
      result.map((booking) => booking.id),
    ).toEqual(["included"]);
  });

  it("returns a deliberately broad UTC query window", () => {
    expect(
      getBroadUtcActivityWindow(
        "2026-07-13",
      ),
    ).toEqual({
      startAt:
        "2026-07-12T00:00:00.000Z",
      endAt:
        "2026-07-15T00:00:00.000Z",
    });
  });

  it("rejects invalid timestamps", () => {
    expect(
      isTimestampOnLocalDate({
        timestamp: "not-a-date",
        localDate: "2026-07-13",
      }),
    ).toBe(false);
  });
});

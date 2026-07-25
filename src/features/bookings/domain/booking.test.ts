import { describe, expect, it } from "vitest";

import {
  calculateStayNights,
  resolveBookingLifecycle,
  resolveSynchronizationStatus,
} from "./booking";

const now = new Date("2026-07-24T16:00:00.000Z");

describe("booking lifecycle", () => {
  it.each([
    ["cancelled", "2026-07-25", "2026-07-28", "cancelled"],
    ["completed", "2026-07-20", "2026-07-22", "completed"],
    ["confirmed", "2026-07-24", "2026-07-26", "arriving-today"],
    ["confirmed", "2026-07-22", "2026-07-24", "checking-out-today"],
    ["confirmed", "2026-07-22", "2026-07-26", "in-stay"],
    ["confirmed", "2026-07-25", "2026-07-28", "upcoming"],
  ] as const)(
    "normalizes %s from %s to %s as %s",
    (storedStatus, arrival, departure, expected) => {
      expect(
        resolveBookingLifecycle({
          storedStatus,
          arrival,
          departure,
          now,
        }),
      ).toBe(expected);
    },
  );

  it("represents an explicit check-in independently from provider language", () => {
    expect(
      resolveBookingLifecycle({
        storedStatus: "confirmed",
        arrival: "2026-07-24",
        departure: "2026-07-26",
        checkedIn: true,
        now,
      }),
    ).toBe("checked-in");
  });

  it("calculates stay duration and rejects invalid periods", () => {
    expect(calculateStayNights("2026-07-24", "2026-07-28")).toBe(4);
    expect(() => calculateStayNights("2026-07-24", "2026-07-24")).toThrow(
      "departure",
    );
  });
});

describe("booking synchronization freshness", () => {
  it.each([
    [{ running: true }, "sync-in-progress"],
    [{ failed: true }, "failed"],
    [{ lastSynchronizedAt: null }, "never-synchronized"],
    [{ lastSynchronizedAt: "2026-07-24T15:00:00.000Z" }, "current"],
    [{ lastSynchronizedAt: "2026-07-22T15:00:00.000Z" }, "stale"],
  ] as const)("maps synchronization evidence to %s", (input, expected) => {
    expect(
      resolveSynchronizationStatus({
        lastSynchronizedAt: null,
        ...input,
        now,
      }),
    ).toBe(expected);
  });
});

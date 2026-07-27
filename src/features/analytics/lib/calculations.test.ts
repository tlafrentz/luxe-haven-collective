import { describe, expect, it } from "vitest";

import type { AnalyticsBooking } from "../types";
import { calculateDashboardMetrics } from "./calculations";

const longStay: AnalyticsBooking = {
  id: "booking-1",
  propertyId: "property-1",
  guestFullName: "Guest",
  checkIn: "2026-06-29",
  checkOut: "2026-08-31",
  guests: 2,
  nightlyRate: 162,
  cleaningFee: 126,
  taxes: 252,
  serviceFee: 63,
  totalAmount: 10_647,
  status: "confirmed",
  paymentStatus: "paid",
  source: "hospitable",
  createdAt: "2026-05-01T12:00:00.000Z",
};

describe("calculateDashboardMetrics", () => {
  it("recognizes the overlapping share of gross revenue for a long stay", () => {
    const metrics = calculateDashboardMetrics({
      bookings: [longStay],
      propertyCount: 1,
      dateRange: { startDate: "2026-07-01", endDate: "2026-07-27" },
      today: "2026-07-26",
    });

    expect(metrics.occupiedNights).toBe(26);
    expect(metrics.averageDailyRate).toBe(162);
    expect(metrics.roomRevenue).toBe(4212);
    expect(metrics.grossRevenue).toBeCloseTo(4393.999, 2);
    expect(metrics.grossRevenue).toBeGreaterThan(0);
  });
});

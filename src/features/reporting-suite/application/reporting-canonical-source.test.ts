import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { mapPortfolioProjectionToReportSourceMetrics } from "./reporting-canonical-source";

describe("reporting canonical source", () => {
  it("maps canonical portfolio values without changing zero or missing data", () => {
    const metrics = mapPortfolioProjectionToReportSourceMetrics({
      performance: {
        grossRevenue: 1200,
        occupancy: 0.5,
        adr: 200,
        revpar: 100,
        bookingCount: 0,
      },
      freshness: "current",
      generatedAt: "2026-08-11T12:00:00.000Z",
      evidence: {
        items: [
          {
            id: "booking-evidence",
            kind: "bookings",
            observedAt: "2026-08-10T12:00:00.000Z",
          },
        ],
      },
    } as never);

    expect(metrics["gross-revenue"]).toMatchObject({
      status: "available",
      value: 1200,
      freshness: { status: "current" },
    });
    expect(metrics["total-bookings"]).toMatchObject({
      status: "available",
      value: 0,
    });
    expect(metrics["average-length-of-stay"]).toMatchObject({
      status: "missing",
      reasonCode: "CANONICAL_SOURCE_UNAVAILABLE",
    });
    expect(metrics["gross-revenue"]?.lineage[0]).toMatchObject({
      sourceType: "booking_record",
      sourceId: "booking-evidence",
    });
  });
});

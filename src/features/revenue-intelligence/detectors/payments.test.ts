import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createAnalyticsBooking,
  createOpportunityDetectionContext,
  createPropertyPerformance,
} from "../test-support/factories";

import {
  paymentsOpportunityDetector,
} from "./payments";

describe("paymentsOpportunityDetector", () => {
  it("detects authorized payments that require capture", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "authorized-1",
            paymentStatus: "authorized",
            totalAmount: 500,
          }),
          createAnalyticsBooking({
            id: "authorized-2",
            paymentStatus: "authorized",
            totalAmount: 750,
          }),
          createAnalyticsBooking({
            id: "paid-1",
            paymentStatus: "paid",
            totalAmount: 600,
          }),
        ],
      });

    const result =
      paymentsOpportunityDetector.detect(
        context,
      );

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      id:
        "payments:uncaptured-payment:property-1",
      detectorId: "payments",
      type: "uncaptured-payment",
      category: "operations",
      severity: "high",
      confidence: "high",
      status: "open",
      propertyId: "property-1",
      impact: {
        type: "revenue-at-risk",
        estimatedAmount: 1250,
        currency: "USD",
      },
      action: {
        type: "review-payment",
      },
    });

    expect(result[0].evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "authorizedReservationCount",
          value: 2,
        }),
        expect.objectContaining({
          key: "authorizedReservationValue",
          value: 1250,
        }),
      ]),
    );
  });

  it("detects unpaid active reservations", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "unpaid-1",
            paymentStatus: "unpaid",
            totalAmount: 400,
          }),
          createAnalyticsBooking({
            id: "unpaid-2",
            paymentStatus: "unpaid",
            totalAmount: 650,
          }),
        ],
      });

    const result =
      paymentsOpportunityDetector.detect(
        context,
      );

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      id:
        "payments:unpaid-reservation:property-1",
      type: "unpaid-reservation",
      severity: "high",
      confidence: "high",
      impact: {
        type: "revenue-at-risk",
        estimatedAmount: 1050,
        currency: "USD",
      },
      action: {
        type: "review-payment",
      },
    });

    expect(result[0].evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "unpaidReservationCount",
          value: 2,
        }),
        expect.objectContaining({
          key: "unpaidReservationValue",
          value: 1050,
        }),
      ]),
    );
  });

  it("returns separate authorized and unpaid opportunities", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "authorized",
            paymentStatus: "authorized",
            totalAmount: 500,
          }),
          createAnalyticsBooking({
            id: "unpaid",
            paymentStatus: "unpaid",
            totalAmount: 700,
          }),
        ],
      });

    const result =
      paymentsOpportunityDetector.detect(
        context,
      );

    expect(
      result.map(
        (opportunity) => opportunity.type,
      ),
    ).toEqual([
      "uncaptured-payment",
      "unpaid-reservation",
    ]);
  });

  it("excludes canceled reservations", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "cancelled-authorized",
            status: "cancelled",
            paymentStatus: "authorized",
          }),
          createAnalyticsBooking({
            id: "cancelled-unpaid",
            status: "cancelled",
            paymentStatus: "unpaid",
          }),
        ],
      });

    expect(
      paymentsOpportunityDetector.detect(
        context,
      ),
    ).toEqual([]);
  });

  it("returns no opportunity when active reservations are paid", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            paymentStatus: "paid",
          }),
          createAnalyticsBooking({
            id: "paid-2",
            paymentStatus: "paid",
          }),
        ],
      });

    expect(
      paymentsOpportunityDetector.detect(
        context,
      ),
    ).toEqual([]);
  });

  it("creates portfolio-scoped opportunities", () => {
    const context =
      createOpportunityDetectionContext({
        performance:
          createPropertyPerformance({
            scope: {
              type: "portfolio",
              propertyId: null,
              propertyCount: 3,
            },
          }),
        bookings: [
          createAnalyticsBooking({
            paymentStatus: "unpaid",
          }),
        ],
      });

    const result =
      paymentsOpportunityDetector.detect(
        context,
      );

    expect(result[0]).toMatchObject({
      id:
        "payments:unpaid-reservation:portfolio",
      propertyId: null,
    });
  });
});

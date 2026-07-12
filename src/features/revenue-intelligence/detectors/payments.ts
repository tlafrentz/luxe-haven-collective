import type {
  AnalyticsBooking,
} from "@/features/analytics";

import type {
  OpportunityDetectionContext,
  OpportunityDetector,
  RevenueOpportunity,
} from "../types";

const DETECTOR_ID = "payments";

function isActiveBooking(
  booking: AnalyticsBooking,
): boolean {
  return booking.status !== "cancelled";
}

function createOpportunityId({
  type,
  propertyId,
}: {
  type:
    | "uncaptured-payment"
    | "unpaid-reservation";
  propertyId: string | null;
}): string {
  return [
    DETECTOR_ID,
    type,
    propertyId ?? "portfolio",
  ].join(":");
}

function detectAuthorizedPayments({
  bookings,
  propertyId,
  detectedAt,
}: {
  bookings: AnalyticsBooking[];
  propertyId: string | null;
  detectedAt: string;
}): RevenueOpportunity[] {
  const authorizedBookings = bookings.filter(
    (booking) =>
      isActiveBooking(booking) &&
      booking.paymentStatus === "authorized",
  );

  if (authorizedBookings.length === 0) {
    return [];
  }

  const affectedRevenue =
    authorizedBookings.reduce(
      (total, booking) =>
        total + booking.totalAmount,
      0,
    );

  return [
    {
      id: createOpportunityId({
        type: "uncaptured-payment",
        propertyId,
      }),
      detectorId: DETECTOR_ID,
      type: "uncaptured-payment",
      category: "operations",
      severity: "high",
      confidence: "high",
      status: "open",
      propertyId,
      detectedAt,
      title: "Authorized payments require capture",
      summary: `${authorizedBookings.length} ${
        authorizedBookings.length === 1
          ? "reservation has"
          : "reservations have"
      } an authorized payment that has not been captured.`,
      evidence: [
        {
          key: "authorizedReservationCount",
          label: "Authorized reservations",
          value: authorizedBookings.length,
          unit: "count",
        },
        {
          key: "authorizedReservationValue",
          label: "Reservation value",
          value: affectedRevenue,
          unit: "currency",
        },
      ],
      impact: {
        type: "revenue-at-risk",
        estimatedAmount: affectedRevenue,
        currency: "USD",
        basis:
          "Sum of total reservation amounts for active reservations with an authorized payment status.",
      },
      action: {
        type: "review-payment",
        summary:
          "Review the affected reservations and capture payment before the applicable check-in dates.",
        parameters: {
          reservationCount:
            authorizedBookings.length,
        },
      },
    },
  ];
}

function detectUnpaidReservations({
  bookings,
  propertyId,
  detectedAt,
}: {
  bookings: AnalyticsBooking[];
  propertyId: string | null;
  detectedAt: string;
}): RevenueOpportunity[] {
  const unpaidBookings = bookings.filter(
    (booking) =>
      isActiveBooking(booking) &&
      booking.paymentStatus === "unpaid",
  );

  if (unpaidBookings.length === 0) {
    return [];
  }

  const affectedRevenue =
    unpaidBookings.reduce(
      (total, booking) =>
        total + booking.totalAmount,
      0,
    );

  return [
    {
      id: createOpportunityId({
        type: "unpaid-reservation",
        propertyId,
      }),
      detectorId: DETECTOR_ID,
      type: "unpaid-reservation",
      category: "operations",
      severity: "high",
      confidence: "high",
      status: "open",
      propertyId,
      detectedAt,
      title: "Unpaid reservations require attention",
      summary: `${unpaidBookings.length} ${
        unpaidBookings.length === 1
          ? "active reservation is"
          : "active reservations are"
      } currently unpaid.`,
      evidence: [
        {
          key: "unpaidReservationCount",
          label: "Unpaid reservations",
          value: unpaidBookings.length,
          unit: "count",
        },
        {
          key: "unpaidReservationValue",
          label: "Reservation value",
          value: affectedRevenue,
          unit: "currency",
        },
      ],
      impact: {
        type: "revenue-at-risk",
        estimatedAmount: affectedRevenue,
        currency: "USD",
        basis:
          "Sum of total reservation amounts for active reservations with an unpaid payment status.",
      },
      action: {
        type: "review-payment",
        summary:
          "Confirm payment collection is scheduled or contact the guest before arrival.",
        parameters: {
          reservationCount:
            unpaidBookings.length,
        },
      },
    },
  ];
}

export const paymentsOpportunityDetector: OpportunityDetector =
  {
    id: DETECTOR_ID,
    opportunityTypes: [
      "uncaptured-payment",
      "unpaid-reservation",
    ],
    detect(
      context: OpportunityDetectionContext,
    ): RevenueOpportunity[] {
      const propertyId =
        context.performance.scope.propertyId;

      return [
        ...detectAuthorizedPayments({
          bookings: context.bookings,
          propertyId,
          detectedAt: context.detectedAt,
        }),
        ...detectUnpaidReservations({
          bookings: context.bookings,
          propertyId,
          detectedAt: context.detectedAt,
        }),
      ];
    },
  };

import type { AnalyticsBooking } from "../domain/revenue-input";
import { revenueAnalyticsGateway } from "../adapters/analytics-input-adapter";

const { differenceInNights } = revenueAnalyticsGateway;

import type {
  OpportunityConfidence,
  OpportunityDetectionContext,
  OpportunityDetector,
  OpportunitySeverity,
  RevenueOpportunity,
} from "../types";

const DETECTOR_ID = "gap-nights";

const MINIMUM_GAP_NIGHTS = 1;
const MAXIMUM_GAP_NIGHTS = 3;
const HIGH_URGENCY_DAYS = 14;
const MEDIUM_URGENCY_DAYS = 30;

type GapNightCandidate = {
  propertyId: string;
  gapStart: string;
  gapEnd: string;
  gapNights: number;
  previousBooking: AnalyticsBooking;
  nextBooking: AnalyticsBooking;
};

function isRevenueBooking(
  booking: AnalyticsBooking,
): boolean {
  return (
    booking.status === "confirmed" ||
    booking.status === "completed"
  );
}

function groupBookingsByProperty(
  bookings: AnalyticsBooking[],
): Map<string, AnalyticsBooking[]> {
  const bookingsByProperty = new Map<
    string,
    AnalyticsBooking[]
  >();

  for (const booking of bookings) {
    if (!isRevenueBooking(booking)) {
      continue;
    }

    const existingBookings =
      bookingsByProperty.get(
        booking.propertyId,
      ) ?? [];

    existingBookings.push(booking);

    bookingsByProperty.set(
      booking.propertyId,
      existingBookings,
    );
  }

  for (const propertyBookings of bookingsByProperty.values()) {
    propertyBookings.sort(
      (first, second) => {
        const checkInDifference =
          first.checkIn.localeCompare(
            second.checkIn,
          );

        if (checkInDifference !== 0) {
          return checkInDifference;
        }

        return first.checkOut.localeCompare(
          second.checkOut,
        );
      },
    );
  }

  return bookingsByProperty;
}

function findPropertyGapNights({
  propertyId,
  bookings,
  today,
}: {
  propertyId: string;
  bookings: AnalyticsBooking[];
  today: string;
}): GapNightCandidate[] {
  if (bookings.length < 2) {
    return [];
  }

  const candidates: GapNightCandidate[] = [];

  let previousBooking = bookings[0];

  for (
    let index = 1;
    index < bookings.length;
    index += 1
  ) {
    const nextBooking = bookings[index];

    /*
     * Overlapping reservations can occur because of
     * imports, channel-sync timing, or data errors.
     *
     * Keep the reservation with the later checkout as
     * the active timeline boundary.
     */
    if (
      nextBooking.checkIn <
      previousBooking.checkOut
    ) {
      if (
        nextBooking.checkOut >
        previousBooking.checkOut
      ) {
        previousBooking = nextBooking;
      }

      continue;
    }

    const gapStart =
      previousBooking.checkOut;

    const gapEnd = nextBooking.checkIn;

    const gapNights = differenceInNights(
      gapStart,
      gapEnd,
    );

    if (
      gapStart >= today &&
      gapNights >= MINIMUM_GAP_NIGHTS &&
      gapNights <= MAXIMUM_GAP_NIGHTS
    ) {
      candidates.push({
        propertyId,
        gapStart,
        gapEnd,
        gapNights,
        previousBooking,
        nextBooking,
      });
    }

    previousBooking = nextBooking;
  }

  return candidates;
}

function getDaysUntilGap({
  gapStart,
  today,
}: {
  gapStart: string;
  today: string;
}): number {
  return differenceInNights(
    today,
    gapStart,
  );
}

function getSeverity(
  daysUntilGap: number,
): OpportunitySeverity {
  if (daysUntilGap <= HIGH_URGENCY_DAYS) {
    return "high";
  }

  if (daysUntilGap <= MEDIUM_URGENCY_DAYS) {
    return "medium";
  }

  return "low";
}

function getConfidence({
  previousRate,
  nextRate,
}: {
  previousRate: number;
  nextRate: number;
}): OpportunityConfidence {
  const positiveRateCount = [
    previousRate,
    nextRate,
  ].filter((rate) => rate > 0).length;

  if (positiveRateCount === 2) {
    return "high";
  }

  if (positiveRateCount === 1) {
    return "medium";
  }

  return "low";
}

function getReferenceNightlyRate({
  previousRate,
  nextRate,
}: {
  previousRate: number;
  nextRate: number;
}): number {
  const positiveRates = [
    previousRate,
    nextRate,
  ].filter((rate) => rate > 0);

  if (positiveRates.length === 0) {
    return 0;
  }

  const total = positiveRates.reduce(
    (sum, rate) => sum + rate,
    0,
  );

  return (
    Math.round(
      ((total / positiveRates.length) +
        Number.EPSILON) *
        100,
    ) / 100
  );
}

function roundCurrency(
  value: number,
): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

function createOpportunityId(
  candidate: GapNightCandidate,
): string {
  return [
    DETECTOR_ID,
    "gap-night",
    candidate.propertyId,
    candidate.gapStart,
    candidate.gapEnd,
  ].join(":");
}

function createGapNightOpportunity({
  candidate,
  detectedAt,
  today,
}: {
  candidate: GapNightCandidate;
  detectedAt: string;
  today: string;
}): RevenueOpportunity {
  const referenceNightlyRate =
    getReferenceNightlyRate({
      previousRate:
        candidate.previousBooking
          .nightlyRate,
      nextRate:
        candidate.nextBooking.nightlyRate,
    });

  const estimatedRevenueImpact =
    roundCurrency(
      referenceNightlyRate *
        candidate.gapNights,
    );

  const daysUntilGap = getDaysUntilGap({
    gapStart: candidate.gapStart,
    today,
  });

  return {
    id: createOpportunityId(candidate),
    detectorId: DETECTOR_ID,
    type: "gap-night",
    category: "occupancy",
    severity: getSeverity(daysUntilGap),
    confidence: getConfidence({
      previousRate:
        candidate.previousBooking
          .nightlyRate,
      nextRate:
        candidate.nextBooking.nightlyRate,
    }),
    status: "open",
    propertyId: candidate.propertyId,
    dateRange: {
      startDate: candidate.gapStart,
      endDate: candidate.gapEnd,
    },
    detectedAt,
    title: `${candidate.gapNights}-night calendar gap detected`,
    summary:
      `${candidate.gapNights} unbooked ${
        candidate.gapNights === 1
          ? "night is"
          : "nights are"
      } trapped between two reservations from ${candidate.gapStart} through ${candidate.gapEnd}.`,
    evidence: [
      {
        key: "gapNightCount",
        label: "Gap nights",
        value: candidate.gapNights,
        unit: "nights",
      },
      {
        key: "gapStart",
        label: "Gap begins",
        value: candidate.gapStart,
      },
      {
        key: "gapEnd",
        label: "Next check-in",
        value: candidate.gapEnd,
      },
      {
        key: "daysUntilGap",
        label: "Days until gap",
        value: daysUntilGap,
        unit: "days",
      },
      {
        key: "previousNightlyRate",
        label: "Previous reservation rate",
        value:
          candidate.previousBooking
            .nightlyRate,
        unit: "currency",
      },
      {
        key: "nextNightlyRate",
        label: "Next reservation rate",
        value:
          candidate.nextBooking.nightlyRate,
        unit: "currency",
      },
      {
        key: "referenceNightlyRate",
        label: "Reference nightly rate",
        value: referenceNightlyRate,
        unit: "currency",
      },
    ],
    impact: {
      type: "revenue-increase",
      estimatedAmount:
        estimatedRevenueImpact,
      currency: "USD",
      basis:
        "Gap nights multiplied by the average positive nightly rate of the reservations immediately before and after the gap. This represents potential room revenue, not guaranteed incremental revenue.",
    },
    action: {
      type: "apply-discount",
      summary:
        "Review minimum-stay restrictions and consider a targeted gap-night promotion or length-of-stay discount.",
      parameters: {
        gapStart: candidate.gapStart,
        gapEnd: candidate.gapEnd,
        gapNights: candidate.gapNights,
        referenceNightlyRate,
        suggestedDiscountPercent:
          daysUntilGap <=
          HIGH_URGENCY_DAYS
            ? 15
            : 10,
      },
    },
  };
}

export const gapNightOpportunityDetector: OpportunityDetector =
  {
    id: DETECTOR_ID,
    opportunityTypes: ["gap-night"],
    detect(
      context: OpportunityDetectionContext,
    ): RevenueOpportunity[] {
      const today =
        context.detectedAt.slice(0, 10);

      if (!today) {
        return [];
      }

      const bookingsByProperty =
        groupBookingsByProperty(
          context.bookings,
        );

      const opportunities: RevenueOpportunity[] =
        [];

      for (
        const [
          propertyId,
          bookings,
        ] of bookingsByProperty
      ) {
        const candidates =
          findPropertyGapNights({
            propertyId,
            bookings,
            today,
          });

        opportunities.push(
          ...candidates.map((candidate) =>
            createGapNightOpportunity({
              candidate,
              detectedAt:
                context.detectedAt,
              today,
            }),
          ),
        );
      }

      return opportunities;
    },
  };

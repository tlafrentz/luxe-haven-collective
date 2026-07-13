import type {
  BookingSourceMetric,
} from "@/features/analytics";

import type {
  OpportunityConfidence,
  OpportunityDetectionContext,
  OpportunityDetector,
  OpportunitySeverity,
  RevenueOpportunity,
} from "../types";

const DETECTOR_ID = "booking-source-concentration";

const MINIMUM_BOOKINGS = 5;
const MINIMUM_SOURCE_COUNT = 2;
const CONCENTRATION_THRESHOLD = 70;
const HIGH_CONCENTRATION_THRESHOLD = 90;
const ELEVATED_CONCENTRATION_THRESHOLD = 80;
const ELEVATED_VOLUME_THRESHOLD = 15;

function getActiveSources(
  sources: BookingSourceMetric[],
): BookingSourceMetric[] {
  return sources.filter(
    (source) => source.bookingCount > 0,
  );
}

function getDominantSource(
  sources: BookingSourceMetric[],
): BookingSourceMetric | null {
  return (
    [...sources].sort(
      (first, second) => {
        if (
          second.bookingShare !==
          first.bookingShare
        ) {
          return (
            second.bookingShare -
            first.bookingShare
          );
        }

        if (
          second.roomRevenue !==
          first.roomRevenue
        ) {
          return (
            second.roomRevenue -
            first.roomRevenue
          );
        }

        return first.source.localeCompare(
          second.source,
        );
      },
    )[0] ?? null
  );
}

function getConfidence(
  totalBookings: number,
): OpportunityConfidence {
  if (totalBookings >= 20) {
    return "high";
  }

  if (totalBookings >= 10) {
    return "medium";
  }

  return "low";
}

function getSeverity({
  dominantShare,
  totalBookings,
}: {
  dominantShare: number;
  totalBookings: number;
}): OpportunitySeverity {
  if (
    dominantShare >=
      HIGH_CONCENTRATION_THRESHOLD ||
    (
      dominantShare >=
        ELEVATED_CONCENTRATION_THRESHOLD &&
      totalBookings >=
        ELEVATED_VOLUME_THRESHOLD
    )
  ) {
    return "high";
  }

  return "medium";
}

function shouldCreateOpportunity({
  totalBookings,
  sourceCount,
  dominantShare,
}: {
  totalBookings: number;
  sourceCount: number;
  dominantShare: number;
}): boolean {
  return (
    totalBookings >= MINIMUM_BOOKINGS &&
    sourceCount >= MINIMUM_SOURCE_COUNT &&
    dominantShare >=
      CONCENTRATION_THRESHOLD
  );
}

function createOpportunityId({
  propertyId,
  source,
}: {
  propertyId: string | null;
  source: string;
}): string {
  return [
    DETECTOR_ID,
    "source-concentration",
    propertyId ?? "portfolio",
    source,
  ].join(":");
}

function formatSourceName(
  source: string,
): string {
  if (source === "unknown") {
    return "Unknown source";
  }

  return source
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

function createSourceConcentrationOpportunity({
  context,
  dominantSource,
  sourceCount,
  totalBookings,
}: {
  context: OpportunityDetectionContext;
  dominantSource: BookingSourceMetric;
  sourceCount: number;
  totalBookings: number;
}): RevenueOpportunity {
  const propertyId =
    context.performance.scope.propertyId;

  const sourceName = formatSourceName(
    dominantSource.source,
  );

  return {
    id: createOpportunityId({
      propertyId,
      source: dominantSource.source,
    }),
    detectorId: DETECTOR_ID,
    type: "source-concentration",
    category: "distribution",
    severity: getSeverity({
      dominantShare:
        dominantSource.bookingShare,
      totalBookings,
    }),
    confidence: getConfidence(totalBookings),
    status: "open",
    propertyId,
    dateRange: {
      startDate:
        context.performance.period.startDate,
      endDate:
        context.performance.period.endDate,
    },
    detectedAt: context.detectedAt,
    title: "Booking-source concentration is elevated",
    summary:
      `${sourceName} represents ${dominantSource.bookingShare.toFixed(
        1,
      )}% of bookings in the selected period, creating dependence on a single distribution source.`,
    evidence: [
      {
        key: "dominantSource",
        label: "Dominant booking source",
        value: dominantSource.source,
      },
      {
        key: "dominantSourceBookingShare",
        label: "Booking share",
        value: dominantSource.bookingShare,
        unit: "percentage",
      },
      {
        key: "dominantSourceBookingCount",
        label: "Bookings from source",
        value: dominantSource.bookingCount,
        unit: "count",
      },
      {
        key: "dominantSourceRoomRevenue",
        label: "Room revenue from source",
        value: dominantSource.roomRevenue,
        unit: "currency",
      },
      {
        key: "representedSourceCount",
        label: "Sources represented",
        value: sourceCount,
        unit: "count",
      },
      {
        key: "totalBookingCount",
        label: "Bookings analyzed",
        value: totalBookings,
        unit: "count",
      },
    ],
    impact: {
      type: "operational-risk",
      basis:
        "A high share of reservations from one booking source increases exposure to channel policy changes, ranking volatility, account disruption, fee changes, and demand shifts.",
    },
    action: {
      type: "diversify-booking-sources",
      summary:
        "Review direct-booking, repeat-guest, and secondary-channel opportunities to reduce dependence on the dominant source.",
      parameters: {
        dominantSource:
          dominantSource.source,
        dominantSourceShare:
          dominantSource.bookingShare,
        representedSourceCount:
          sourceCount,
      },
    },
  };
}

export const bookingSourceConcentrationOpportunityDetector: OpportunityDetector =
  {
    id: DETECTOR_ID,
    opportunityTypes: [
      "source-concentration",
    ],
    detect(
      context: OpportunityDetectionContext,
    ): RevenueOpportunity[] {
      const sources = getActiveSources(
        context.performance.bookingBehavior
          .sources,
      );

      const dominantSource =
        getDominantSource(sources);

      if (!dominantSource) {
        return [];
      }

      const totalBookings =
        context.performance.bookings
          .totalBookings;

      if (
        !shouldCreateOpportunity({
          totalBookings,
          sourceCount: sources.length,
          dominantShare:
            dominantSource.bookingShare,
        })
      ) {
        return [];
      }

      return [
        createSourceConcentrationOpportunity({
          context,
          dominantSource,
          sourceCount: sources.length,
          totalBookings,
        }),
      ];
    },
  };

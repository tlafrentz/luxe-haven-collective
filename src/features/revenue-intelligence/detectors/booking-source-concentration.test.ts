import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createBookingSourceMetric,
  createOpportunityDetectionContext,
  createPropertyPerformance,
} from "../test-support/factories";

import {
  bookingSourceConcentrationOpportunityDetector,
} from "./booking-source-concentration";

function createSourceContext({
  totalBookings,
  sources,
}: {
  totalBookings: number;
  sources: ReturnType<
    typeof createBookingSourceMetric
  >[];
}) {
  return createOpportunityDetectionContext({
    performance:
      createPropertyPerformance({
        bookings: {
          totalBookings,
          upcomingBookings: 0,
          completedBookings:
            totalBookings,
          cancelledBookings: 0,
          cancellationRate: 0,
          averageBookingLeadTime: 20,
          averageLengthOfStay: 3,
        },
        bookingBehavior: {
          sources,
          stayLengthDistribution: [],
        },
      }),
  });
}

describe(
  "bookingSourceConcentrationOpportunityDetector",
  () => {
    it("detects concentration when one source represents at least seventy percent of bookings", () => {
      const context = createSourceContext({
        totalBookings: 10,
        sources: [
          createBookingSourceMetric({
            source: "airbnb",
            bookingCount: 7,
            bookingShare: 70,
            occupiedNights: 21,
            roomRevenue: 3150,
          }),
          createBookingSourceMetric({
            source: "direct",
            bookingCount: 3,
            bookingShare: 30,
            occupiedNights: 9,
            roomRevenue: 1350,
          }),
        ],
      });

      const result =
        bookingSourceConcentrationOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        id:
          "booking-source-concentration:source-concentration:property-1:airbnb",
        detectorId:
          "booking-source-concentration",
        type: "source-concentration",
        category: "distribution",
        severity: "medium",
        confidence: "medium",
        propertyId: "property-1",
        action: {
          type: "diversify-booking-sources",
        },
      });

      expect(result[0].evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "dominantSource",
            value: "airbnb",
          }),
          expect.objectContaining({
            key: "dominantSourceBookingShare",
            value: 70,
          }),
          expect.objectContaining({
            key: "representedSourceCount",
            value: 2,
          }),
          expect.objectContaining({
            key: "totalBookingCount",
            value: 10,
          }),
        ]),
      );
    });

    it("uses high severity at ninety percent concentration", () => {
      const context = createSourceContext({
        totalBookings: 10,
        sources: [
          createBookingSourceMetric({
            source: "airbnb",
            bookingCount: 9,
            bookingShare: 90,
          }),
          createBookingSourceMetric({
            source: "direct",
            bookingCount: 1,
            bookingShare: 10,
          }),
        ],
      });

      const result =
        bookingSourceConcentrationOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe(
        "high",
      );
    });

    it("uses high severity at eighty percent concentration with at least fifteen bookings", () => {
      const context = createSourceContext({
        totalBookings: 20,
        sources: [
          createBookingSourceMetric({
            source: "airbnb",
            bookingCount: 16,
            bookingShare: 80,
          }),
          createBookingSourceMetric({
            source: "direct",
            bookingCount: 4,
            bookingShare: 20,
          }),
        ],
      });

      const result =
        bookingSourceConcentrationOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe(
        "high",
      );
      expect(result[0].confidence).toBe(
        "high",
      );
    });

    it("uses low confidence for five to nine bookings", () => {
      const context = createSourceContext({
        totalBookings: 5,
        sources: [
          createBookingSourceMetric({
            source: "airbnb",
            bookingCount: 4,
            bookingShare: 80,
          }),
          createBookingSourceMetric({
            source: "direct",
            bookingCount: 1,
            bookingShare: 20,
          }),
        ],
      });

      const result =
        bookingSourceConcentrationOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(
        "low",
      );
    });

    it("does not trigger below five bookings", () => {
      const context = createSourceContext({
        totalBookings: 4,
        sources: [
          createBookingSourceMetric({
            source: "airbnb",
            bookingCount: 3,
            bookingShare: 75,
          }),
          createBookingSourceMetric({
            source: "direct",
            bookingCount: 1,
            bookingShare: 25,
          }),
        ],
      });

      expect(
        bookingSourceConcentrationOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("does not trigger when fewer than two active sources are represented", () => {
      const context = createSourceContext({
        totalBookings: 10,
        sources: [
          createBookingSourceMetric({
            source: "airbnb",
            bookingCount: 10,
            bookingShare: 100,
          }),
          createBookingSourceMetric({
            source: "direct",
            bookingCount: 0,
            bookingShare: 0,
          }),
        ],
      });

      expect(
        bookingSourceConcentrationOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("does not trigger below the seventy-percent concentration threshold", () => {
      const context = createSourceContext({
        totalBookings: 10,
        sources: [
          createBookingSourceMetric({
            source: "airbnb",
            bookingCount: 6,
            bookingShare: 60,
          }),
          createBookingSourceMetric({
            source: "direct",
            bookingCount: 4,
            bookingShare: 40,
          }),
        ],
      });

      expect(
        bookingSourceConcentrationOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("uses revenue and source name as deterministic tie breakers", () => {
      const context = createSourceContext({
        totalBookings: 10,
        sources: [
          createBookingSourceMetric({
            source: "direct",
            bookingCount: 5,
            bookingShare: 70,
            roomRevenue: 2000,
          }),
          createBookingSourceMetric({
            source: "airbnb",
            bookingCount: 5,
            bookingShare: 70,
            roomRevenue: 3000,
          }),
        ],
      });

      const result =
        bookingSourceConcentrationOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);

      expect(result[0].evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "dominantSource",
            value: "airbnb",
          }),
        ]),
      );
    });
  },
);

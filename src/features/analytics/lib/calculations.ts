import {
  REVENUE_BOOKING_STATUSES,
  type AnalyticsBooking,
  type AnalyticsDateRange,
  type BookingSourceMetric,
  type DashboardMetrics,
  type RevenueBreakdown,
  type StayLengthBucket,
  type StayLengthBucketId,
} from "../types";

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

type MutableBookingSourceMetric = {
  source: string;
  bookingCount: number;
  occupiedNights: number;
  roomRevenue: number;
};

type StayLengthBucketDefinition = {
  id: StayLengthBucketId;
  label: string;
  minimumNights: number;
  maximumNights: number | null;
};

const STAY_LENGTH_BUCKETS: StayLengthBucketDefinition[] = [
  {
    id: "one-night",
    label: "1 night",
    minimumNights: 1,
    maximumNights: 1,
  },
  {
    id: "two-nights",
    label: "2 nights",
    minimumNights: 2,
    maximumNights: 2,
  },
  {
    id: "three-to-four-nights",
    label: "3–4 nights",
    minimumNights: 3,
    maximumNights: 4,
  },
  {
    id: "five-to-seven-nights",
    label: "5–7 nights",
    minimumNights: 5,
    maximumNights: 7,
  },
  {
    id: "eight-to-thirteen-nights",
    label: "8–13 nights",
    minimumNights: 8,
    maximumNights: 13,
  },
  {
    id: "fourteen-to-twenty-nine-nights",
    label: "14–29 nights",
    minimumNights: 14,
    maximumNights: 29,
  },
  {
    id: "thirty-plus-nights",
    label: "30+ nights",
    minimumNights: 30,
    maximumNights: null,
  },
];

function parseUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function parseDateOnly(value: string): string {
  return value.slice(0, 10);
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundMetric(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function normalizeSource(source: string | null): string {
  const normalizedSource = source?.trim().toLowerCase();

  return normalizedSource || "unknown";
}

function isRevenueBooking(
  booking: AnalyticsBooking,
): boolean {
  return REVENUE_BOOKING_STATUSES.some(
    (status) => status === booking.status,
  );
}

function isResolvedBooking(
  booking: AnalyticsBooking,
): boolean {
  return (
    isRevenueBooking(booking) ||
    booking.status === "cancelled"
  );
}

function calculateBookingLeadTime(
  booking: AnalyticsBooking,
): number | null {
  const createdDate = parseUtcDate(
    parseDateOnly(booking.createdAt),
  );
  const checkInDate = parseUtcDate(booking.checkIn);

  if (
    !isValidDate(createdDate) ||
    !isValidDate(checkInDate)
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (checkInDate.getTime() - createdDate.getTime()) /
        MILLISECONDS_PER_DAY,
    ),
  );
}

function getStayLengthBucket(
  stayNights: number,
): StayLengthBucketDefinition | null {
  return (
    STAY_LENGTH_BUCKETS.find((bucket) => {
      if (stayNights < bucket.minimumNights) {
        return false;
      }

      return (
        bucket.maximumNights === null ||
        stayNights <= bucket.maximumNights
      );
    }) ?? null
  );
}

function buildBookingSourceMetrics({
  sourceMetrics,
  totalBookings,
}: {
  sourceMetrics: Map<string, MutableBookingSourceMetric>;
  totalBookings: number;
}): BookingSourceMetric[] {
  return [...sourceMetrics.values()]
    .map((metric) => ({
      source: metric.source,
      bookingCount: metric.bookingCount,
      bookingShare:
        totalBookings > 0
          ? roundMetric(
              (metric.bookingCount / totalBookings) * 100,
            )
          : 0,
      occupiedNights: metric.occupiedNights,
      roomRevenue: roundCurrency(metric.roomRevenue),
      averageDailyRate:
        metric.occupiedNights > 0
          ? roundCurrency(
              metric.roomRevenue /
                metric.occupiedNights,
            )
          : 0,
    }))
    .sort((first, second) => {
      if (second.roomRevenue !== first.roomRevenue) {
        return second.roomRevenue - first.roomRevenue;
      }

      return second.bookingCount - first.bookingCount;
    });
}

function buildStayLengthDistribution({
  bucketMetrics,
  totalBookings,
}: {
  bucketMetrics: Map<
    StayLengthBucketId,
    {
      bookingCount: number;
      occupiedNights: number;
      roomRevenue: number;
    }
  >;
  totalBookings: number;
}): StayLengthBucket[] {
  return STAY_LENGTH_BUCKETS.map((definition) => {
    const metric = bucketMetrics.get(definition.id) ?? {
      bookingCount: 0,
      occupiedNights: 0,
      roomRevenue: 0,
    };

    return {
      ...definition,
      bookingCount: metric.bookingCount,
      bookingShare:
        totalBookings > 0
          ? roundMetric(
              (metric.bookingCount / totalBookings) * 100,
            )
          : 0,
      occupiedNights: metric.occupiedNights,
      roomRevenue: roundCurrency(metric.roomRevenue),
    };
  });
}

export function differenceInNights(
  startDate: string,
  endDate: string,
): number {
  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);

  return Math.max(
    0,
    Math.round(
      (end.getTime() - start.getTime()) /
        MILLISECONDS_PER_DAY,
    ),
  );
}

export function getOverlappingNights(
  bookingCheckIn: string,
  bookingCheckOut: string,
  rangeStart: string,
  rangeEnd: string,
): number {
  const bookingStart = parseUtcDate(bookingCheckIn);
  const bookingEnd = parseUtcDate(bookingCheckOut);
  const reportingStart = parseUtcDate(rangeStart);
  const reportingEnd = parseUtcDate(rangeEnd);

  const overlapStart =
    bookingStart > reportingStart
      ? bookingStart
      : reportingStart;

  const overlapEnd =
    bookingEnd < reportingEnd
      ? bookingEnd
      : reportingEnd;

  if (overlapEnd <= overlapStart) {
    return 0;
  }

  return Math.round(
    (overlapEnd.getTime() - overlapStart.getTime()) /
      MILLISECONDS_PER_DAY,
  );
}

export function calculateDashboardMetrics({
  bookings,
  propertyCount,
  dateRange,
  today = new Date().toISOString().slice(0, 10),
}: {
  bookings: AnalyticsBooking[];
  propertyCount: number;
  dateRange: AnalyticsDateRange;
  today?: string;
}): DashboardMetrics {
  const revenueBookings =
    bookings.filter(isRevenueBooking);

  const resolvedBookings =
    bookings.filter(isResolvedBooking);

  const reportingPeriodNights = differenceInNights(
    dateRange.startDate,
    dateRange.endDate,
  );

  const availableNights =
    reportingPeriodNights * propertyCount;

  let occupiedNights = 0;
  let roomRevenue = 0;
  let grossRevenue = 0;
  let cleaningFees = 0;
  let taxes = 0;
  let serviceFees = 0;
  let otherRevenue = 0;
  let totalStayNights = 0;
  let totalBookingLeadTime = 0;
  let bookingsWithLeadTime = 0;

  const sourceMetrics = new Map<
    string,
    MutableBookingSourceMetric
  >();

  const stayLengthMetrics = new Map<
    StayLengthBucketId,
    {
      bookingCount: number;
      occupiedNights: number;
      roomRevenue: number;
    }
  >();

  for (const booking of revenueBookings) {
    const overlappingNights = getOverlappingNights(
      booking.checkIn,
      booking.checkOut,
      dateRange.startDate,
      dateRange.endDate,
    );

    const fullStayNights = differenceInNights(
      booking.checkIn,
      booking.checkOut,
    );

    const recognizedRoomRevenue =
      booking.nightlyRate * overlappingNights;

    occupiedNights += overlappingNights;
    roomRevenue += recognizedRoomRevenue;
    totalStayNights += fullStayNights;

    const leadTime =
      calculateBookingLeadTime(booking);

    if (leadTime !== null) {
      totalBookingLeadTime += leadTime;
      bookingsWithLeadTime += 1;
    }

    const source = normalizeSource(booking.source);
    const existingSourceMetric =
      sourceMetrics.get(source);

    if (existingSourceMetric) {
      existingSourceMetric.bookingCount += 1;
      existingSourceMetric.occupiedNights +=
        overlappingNights;
      existingSourceMetric.roomRevenue +=
        recognizedRoomRevenue;
    } else {
      sourceMetrics.set(source, {
        source,
        bookingCount: 1,
        occupiedNights: overlappingNights,
        roomRevenue: recognizedRoomRevenue,
      });
    }

    const stayLengthBucket =
      getStayLengthBucket(fullStayNights);

    if (stayLengthBucket) {
      const existingStayMetric =
        stayLengthMetrics.get(stayLengthBucket.id);

      if (existingStayMetric) {
        existingStayMetric.bookingCount += 1;
        existingStayMetric.occupiedNights +=
          overlappingNights;
        existingStayMetric.roomRevenue +=
          recognizedRoomRevenue;
      } else {
        stayLengthMetrics.set(stayLengthBucket.id, {
          bookingCount: 1,
          occupiedNights: overlappingNights,
          roomRevenue: recognizedRoomRevenue,
        });
      }
    }

    /*
     * Reservation-level charges are recognized in the
     * reporting period containing the check-in date.
     */
    if (
      booking.checkIn >= dateRange.startDate &&
      booking.checkIn < dateRange.endDate
    ) {
      const knownRevenue =
        booking.nightlyRate * fullStayNights +
        booking.cleaningFee +
        booking.taxes +
        booking.serviceFee;

      grossRevenue += booking.totalAmount;
      cleaningFees += booking.cleaningFee;
      taxes += booking.taxes;
      serviceFees += booking.serviceFee;
      otherRevenue +=
        booking.totalAmount - knownRevenue;
    }
  }

  const cancelledBookings = bookings.filter(
    (booking) => booking.status === "cancelled",
  ).length;

  const occupancyRate =
    availableNights > 0
      ? (occupiedNights / availableNights) * 100
      : 0;

  const averageDailyRate =
    occupiedNights > 0
      ? roomRevenue / occupiedNights
      : 0;

  const revPar =
    availableNights > 0
      ? roomRevenue / availableNights
      : 0;

  const averageLengthOfStay =
    revenueBookings.length > 0
      ? totalStayNights / revenueBookings.length
      : 0;

  const averageBookingLeadTime =
    bookingsWithLeadTime > 0
      ? totalBookingLeadTime /
        bookingsWithLeadTime
      : 0;

  const cancellationRate =
    resolvedBookings.length > 0
      ? (cancelledBookings /
          resolvedBookings.length) *
        100
      : 0;

  const revenueBreakdown: RevenueBreakdown = {
    roomRevenue: roundCurrency(roomRevenue),
    cleaningFees: roundCurrency(cleaningFees),
    taxes: roundCurrency(taxes),
    serviceFees: roundCurrency(serviceFees),
    otherRevenue: roundCurrency(otherRevenue),
    grossRevenue: roundCurrency(grossRevenue),
  };

  return {
    grossRevenue: roundCurrency(grossRevenue),
    roomRevenue: roundCurrency(roomRevenue),
    occupiedNights,
    availableNights,
    occupancyRate: roundMetric(occupancyRate),
    averageDailyRate: roundCurrency(
      averageDailyRate,
    ),
    revPar: roundCurrency(revPar),
    averageLengthOfStay: roundMetric(
      averageLengthOfStay,
    ),
    averageBookingLeadTime: roundMetric(
      averageBookingLeadTime,
    ),
    cancellationRate: roundMetric(
      cancellationRate,
    ),
    totalBookings: revenueBookings.length,
    upcomingBookings: revenueBookings.filter(
      (booking) => booking.checkIn >= today,
    ).length,
    completedBookings: bookings.filter(
      (booking) =>
        booking.status === "completed",
    ).length,
    cancelledBookings,
    revenueBreakdown,
    bookingSources: buildBookingSourceMetrics({
      sourceMetrics,
      totalBookings: revenueBookings.length,
    }),
    stayLengthDistribution:
      buildStayLengthDistribution({
        bucketMetrics: stayLengthMetrics,
        totalBookings: revenueBookings.length,
      }),
  };
}

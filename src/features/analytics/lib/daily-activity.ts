import type {
  AnalyticsBooking,
} from "../types";

export const DEFAULT_ACTIVITY_TIME_ZONE =
  "America/Chicago";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getDateParts(
  date: Date,
  timeZone: string,
): DateParts {
  const formatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  );

  const parts = formatter.formatToParts(date);

  return {
    year: Number(
      parts.find(
        (part) => part.type === "year",
      )?.value,
    ),
    month: Number(
      parts.find(
        (part) => part.type === "month",
      )?.value,
    ),
    day: Number(
      parts.find(
        (part) => part.type === "day",
      )?.value,
    ),
  };
}

function toDateString({
  year,
  month,
  day,
}: DateParts): string {
  return [
    year.toString().padStart(4, "0"),
    month.toString().padStart(2, "0"),
    day.toString().padStart(2, "0"),
  ].join("-");
}

export function getLocalDateString(
  date: Date,
  timeZone = DEFAULT_ACTIVITY_TIME_ZONE,
): string {
  return toDateString(
    getDateParts(date, timeZone),
  );
}

export function isTimestampOnLocalDate({
  timestamp,
  localDate,
  timeZone = DEFAULT_ACTIVITY_TIME_ZONE,
}: {
  timestamp: string;
  localDate: string;
  timeZone?: string;
}): boolean {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    getLocalDateString(date, timeZone) ===
    localDate
  );
}

export function filterBookingsCreatedOnLocalDate({
  bookings,
  localDate,
  timeZone = DEFAULT_ACTIVITY_TIME_ZONE,
}: {
  bookings: AnalyticsBooking[];
  localDate: string;
  timeZone?: string;
}): AnalyticsBooking[] {
  return bookings.filter((booking) =>
    isTimestampOnLocalDate({
      timestamp: booking.createdAt,
      localDate,
      timeZone,
    }),
  );
}

export function getBroadUtcActivityWindow(
  localDate: string,
): {
  startAt: string;
  endAt: string;
} {
  const date = new Date(
    `${localDate}T00:00:00.000Z`,
  );

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `Invalid local activity date: ${localDate}`,
    );
  }

  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - 1);

  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 2);

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

import type { AnalyticsDateRange } from "../types";

const DEFAULT_TIME_ZONE = "America/Chicago";

function getDateParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = Number(
    parts.find((part) => part.type === "year")?.value,
  );

  const month = Number(
    parts.find((part) => part.type === "month")?.value,
  );

  const day = Number(
    parts.find((part) => part.type === "day")?.value,
  );

  return {
    year,
    month,
    day,
  };
}

function toDateString(
  year: number,
  month: number,
  day: number,
): string {
  return [
    year.toString().padStart(4, "0"),
    month.toString().padStart(2, "0"),
    day.toString().padStart(2, "0"),
  ].join("-");
}

export function addDays(
  dateString: string,
  days: number,
): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function getMonthToDateRange(
  timeZone = DEFAULT_TIME_ZONE,
): AnalyticsDateRange {
  const { year, month, day } = getDateParts(
    new Date(),
    timeZone,
  );

  const today = toDateString(year, month, day);

  return {
    startDate: toDateString(year, month, 1),
    // Analytics end dates are exclusive.
    endDate: addDays(today, 1),
  };
}

export function isValidDateString(
  value: string | undefined,
): value is string {
  if (!value) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function resolveAnalyticsDateRange({
  startDate,
  endDate,
}: {
  startDate?: string;
  endDate?: string;
}): AnalyticsDateRange {
  const defaultRange = getMonthToDateRange();

  const resolvedStart = isValidDateString(startDate)
    ? startDate
    : defaultRange.startDate;

  const resolvedEnd = isValidDateString(endDate)
    ? endDate
    : defaultRange.endDate;

  if (resolvedEnd <= resolvedStart) {
    return defaultRange;
  }

  return {
    startDate: resolvedStart,
    endDate: resolvedEnd,
  };
}

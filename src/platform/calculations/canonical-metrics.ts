export const CANONICAL_CALCULATION_VERSION = "pi-ux-002a-v1";

const MILLISECONDS_PER_DAY = 86_400_000;

export type CanonicalComparison =
  | Readonly<{
      status: "available";
      absolute: number;
      percentage: number;
      direction: "up" | "down" | "neutral";
    }>
  | Readonly<{
      status: "new-measurement";
      absolute: number;
      percentage: null;
      direction: "up";
    }>
  | Readonly<{
      status: "unavailable";
      absolute: number;
      percentage: null;
      direction: "up" | "down" | "neutral";
      reason: string;
    }>;

export function canonicalNights(from: string, to: string): number {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00.000Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / MILLISECONDS_PER_DAY));
}

export function canonicalOverlappingNights(
  stayStart: string,
  stayEnd: string,
  periodStart: string,
  periodEndExclusive: string,
): number {
  const overlapStart = stayStart > periodStart ? stayStart : periodStart;
  const overlapEnd = stayEnd < periodEndExclusive ? stayEnd : periodEndExclusive;
  return overlapEnd > overlapStart ? canonicalNights(overlapStart, overlapEnd) : 0;
}

export function canonicalOccupancy(
  occupiedNights: number,
  availableNights: number,
): number | null {
  if (!Number.isFinite(occupiedNights) || !Number.isFinite(availableNights) || availableNights <= 0) {
    return null;
  }
  return Math.min(1, Math.max(0, occupiedNights / availableNights));
}

export function canonicalAdr(revenue: number | null, occupiedNights: number): number | null {
  if (revenue === null || !Number.isFinite(revenue) || occupiedNights <= 0) return null;
  return revenue / occupiedNights;
}

export function canonicalRevPar(revenue: number | null, availableNights: number): number | null {
  if (revenue === null || !Number.isFinite(revenue) || availableNights <= 0) return null;
  return revenue / availableNights;
}

export function canonicalComparison(
  current: number,
  previous: number,
  options: Readonly<{ nearZeroBaseline?: number }> = {},
): CanonicalComparison {
  const absolute = current - previous;
  const direction = absolute > 0 ? "up" : absolute < 0 ? "down" : "neutral";
  const nearZeroBaseline = options.nearZeroBaseline ?? 0.01;

  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { status: "unavailable", absolute, percentage: null, direction, reason: "Comparison values are not valid measurements." };
  }
  if (absolute === 0) {
    return { status: "available", absolute: 0, percentage: 0, direction: "neutral" };
  }
  if (previous === 0 && current > 0) {
    return { status: "new-measurement", absolute, percentage: null, direction: "up" };
  }
  if (Math.abs(previous) <= nearZeroBaseline && absolute !== 0) {
    return { status: "unavailable", absolute, percentage: null, direction, reason: "The comparison baseline is too small for a useful percentage." };
  }
  return {
    status: "available",
    absolute,
    percentage: (absolute / Math.abs(previous)) * 100,
    direction,
  };
}

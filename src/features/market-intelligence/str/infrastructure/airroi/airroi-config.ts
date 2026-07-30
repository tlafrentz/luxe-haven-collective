import { z } from "zod";

const integer = (fallback: number, min: number, max: number) =>
  z.string().default(String(fallback)).transform(Number).pipe(z.number().int().min(min).max(max));
const schema = z.object({
  MARKET_INTELLIGENCE_ENABLED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  AIRROI_API_KEY: z.string().trim().optional(),
  AIRROI_BASE_URL: z.string().url().default("https://api.airroi.com"),
  AIRROI_REQUEST_TIMEOUT_MS: integer(15_000, 1_000, 60_000),
  AIRROI_MAX_RETRIES: integer(2, 0, 5),
  AIRROI_DEFAULT_RADIUS_MILES: integer(3, 1, 10),
  AIRROI_MAX_RADIUS_MILES: integer(10, 1, 50),
  AIRROI_MAX_COMPARABLES: integer(20, 1, 100),
  AIRROI_TARGET_COMPARABLES: integer(10, 1, 50),
  AIRROI_MIN_COMPARABLES: integer(5, 1, 25),
  AIRROI_MIN_ACTIVE_DAYS: integer(90, 1, 365),
  MARKET_SNAPSHOT_TTL_DAYS: integer(30, 1, 365),
  COMPARABLE_SNAPSHOT_TTL_DAYS: integer(14, 1, 365),
  PROPERTY_SNAPSHOT_TTL_DAYS: integer(7, 1, 365),
}).superRefine((value, context) => {
  if (value.MARKET_INTELLIGENCE_ENABLED && !value.AIRROI_API_KEY) context.addIssue({
    code: "custom", path: ["AIRROI_API_KEY"], message: "AIRROI_API_KEY is required when STR market intelligence is enabled.",
  });
  if (value.AIRROI_DEFAULT_RADIUS_MILES > value.AIRROI_MAX_RADIUS_MILES) context.addIssue({
    code: "custom", path: ["AIRROI_DEFAULT_RADIUS_MILES"], message: "Default radius cannot exceed maximum radius.",
  });
});

export interface AirRoiConfig {
  readonly enabled: boolean; readonly apiKey?: string; readonly baseUrl: string;
  readonly timeoutMs: number; readonly maxRetries: number; readonly defaultRadiusMiles: number;
  readonly maxRadiusMiles: number; readonly maxComparables: number; readonly targetComparables: number;
  readonly minComparables: number; readonly minActiveDays: number; readonly marketSnapshotTtlDays: number;
  readonly comparableSnapshotTtlDays: number; readonly propertySnapshotTtlDays: number;
}

export class AirRoiConfigurationError extends Error { constructor() { super("STR market intelligence configuration is invalid."); this.name = "AirRoiConfigurationError"; } }

export function getAirRoiConfig(environment: Readonly<Record<string, string | undefined>> = process.env): AirRoiConfig {
  const result = schema.safeParse(environment);
  if (!result.success) throw new AirRoiConfigurationError();
  const value = result.data;
  return Object.freeze({
    enabled: value.MARKET_INTELLIGENCE_ENABLED, ...(value.AIRROI_API_KEY ? { apiKey: value.AIRROI_API_KEY } : {}),
    baseUrl: value.AIRROI_BASE_URL, timeoutMs: value.AIRROI_REQUEST_TIMEOUT_MS, maxRetries: value.AIRROI_MAX_RETRIES,
    defaultRadiusMiles: value.AIRROI_DEFAULT_RADIUS_MILES, maxRadiusMiles: value.AIRROI_MAX_RADIUS_MILES,
    maxComparables: value.AIRROI_MAX_COMPARABLES, targetComparables: value.AIRROI_TARGET_COMPARABLES,
    minComparables: value.AIRROI_MIN_COMPARABLES, minActiveDays: value.AIRROI_MIN_ACTIVE_DAYS,
    marketSnapshotTtlDays: value.MARKET_SNAPSHOT_TTL_DAYS, comparableSnapshotTtlDays: value.COMPARABLE_SNAPSHOT_TTL_DAYS,
    propertySnapshotTtlDays: value.PROPERTY_SNAPSHOT_TTL_DAYS,
  });
}

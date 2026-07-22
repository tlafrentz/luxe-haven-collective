import { z } from "zod";

const booleanValue = z.enum(["true", "false"]).default("true").transform((value) => value === "true");
const integer = (fallback: number, minimum: number, maximum: number) => z.string().default(String(fallback)).transform(Number).pipe(z.number().int().min(minimum).max(maximum));

const schema = z.object({
  MARKET_PROVIDER_ENABLED: booleanValue,
  RENTCAST_API_KEY: z.string().trim().optional(),
  RENTCAST_BASE_URL: z.string().url().default("https://api.rentcast.io/v1"),
  RENTCAST_REQUEST_TIMEOUT_MS: integer(10_000, 1_000, 30_000),
  MARKET_PROVIDER_RETRY_COUNT: integer(1, 0, 2),
  MARKET_ANALYSIS_CACHE_TTL_SECONDS: integer(300, 30, 3_600),
  MARKET_ANALYSIS_RATE_LIMIT_PER_MINUTE: integer(6, 1, 60),
}).superRefine((value, context) => {
  if (value.MARKET_PROVIDER_ENABLED && !value.RENTCAST_API_KEY) {
    context.addIssue({ code: "custom", path: ["RENTCAST_API_KEY"], message: "RENTCAST_API_KEY is required when the Market provider is enabled." });
  }
});

export type MarketIntelligenceConfig = Readonly<{
  providerEnabled: boolean;
  rentCastApiKey?: string;
  rentCastBaseUrl: string;
  requestTimeoutMs: number;
  retryCount: number;
  cacheTtlMs: number;
  rateLimitPerMinute: number;
}>;

export class MarketIntelligenceConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MarketIntelligenceConfigurationError";
  }
}

export function getMarketIntelligenceConfig(environment: Readonly<Record<string, string | undefined>> = process.env): MarketIntelligenceConfig {
  const result = schema.safeParse(environment);
  if (!result.success) {
    throw new MarketIntelligenceConfigurationError(result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  }
  return Object.freeze({
    providerEnabled: result.data.MARKET_PROVIDER_ENABLED,
    ...(result.data.RENTCAST_API_KEY ? { rentCastApiKey: result.data.RENTCAST_API_KEY } : {}),
    rentCastBaseUrl: result.data.RENTCAST_BASE_URL,
    requestTimeoutMs: result.data.RENTCAST_REQUEST_TIMEOUT_MS,
    retryCount: result.data.MARKET_PROVIDER_RETRY_COUNT,
    cacheTtlMs: result.data.MARKET_ANALYSIS_CACHE_TTL_SECONDS * 1_000,
    rateLimitPerMinute: result.data.MARKET_ANALYSIS_RATE_LIMIT_PER_MINUTE,
  });
}

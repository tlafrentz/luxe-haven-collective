import { describe, expect, it } from "vitest";

import { getMarketIntelligenceConfig, MarketIntelligenceConfigurationError } from "./market-intelligence-config";

function environment(overrides: Readonly<Record<string, string | undefined>> = {}): Readonly<Record<string, string | undefined>> {
  return { MARKET_PROVIDER_ENABLED: "true", RENTCAST_API_KEY: "secret", ...overrides };
}

describe("getMarketIntelligenceConfig", () => {
  it("materializes bounded production defaults", () => {
    expect(getMarketIntelligenceConfig(environment())).toMatchObject({
      providerEnabled: true, requestTimeoutMs: 10000, retryCount: 1, cacheTtlMs: 300000, rateLimitPerMinute: 6,
    });
  });

  it("allows a disabled provider without an API key", () => {
    const config = getMarketIntelligenceConfig({ MARKET_PROVIDER_ENABLED: "false" });
    expect(config.providerEnabled).toBe(false);
    expect(config.rentCastApiKey).toBeUndefined();
  });

  it("requires a key only when enabled", () => {
    expect(() => getMarketIntelligenceConfig({ MARKET_PROVIDER_ENABLED: "true" })).toThrow(MarketIntelligenceConfigurationError);
  });

  it.each([
    ["RENTCAST_REQUEST_TIMEOUT_MS", "999"],
    ["RENTCAST_REQUEST_TIMEOUT_MS", "30001"],
    ["MARKET_PROVIDER_RETRY_COUNT", "3"],
    ["MARKET_ANALYSIS_CACHE_TTL_SECONDS", "29"],
    ["MARKET_ANALYSIS_RATE_LIMIT_PER_MINUTE", "0"],
  ])("rejects invalid %s", (key, value) => {
    expect(() => getMarketIntelligenceConfig(environment({ [key]: value }))).toThrow(MarketIntelligenceConfigurationError);
  });

  it("never includes the API key in configuration errors", () => {
    const secret = "do-not-serialize-this";
    try { getMarketIntelligenceConfig(environment({ RENTCAST_API_KEY: secret, RENTCAST_BASE_URL: "bad" })); } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});

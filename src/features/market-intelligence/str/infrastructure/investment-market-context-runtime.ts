import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createRealtyApiPropertyProvider } from "../../infrastructure/realtyapi/provider";
import { SupabasePropertySnapshotRepository } from "../../infrastructure/property-snapshot-repository";
import {
  resolveInvestmentMarketContext,
  type ResolveInvestmentMarketContextInput,
  type ResolvedInvestmentMarketContext,
  type StrWorkflowTelemetry,
} from "../application";
import { AirRoiClient } from "./airroi/airroi-client";
import { getAirRoiConfig } from "./airroi/airroi-config";
import { AirRoiProvider } from "./airroi/airroi-provider";
import { AirRoiError } from "./airroi/airroi-errors";
import { SupabaseStrMarketSnapshotRepository } from "./str-market-snapshot-repository";

export async function resolveInvestmentMarketContextAtRuntime(
  input: ResolveInvestmentMarketContextInput,
  telemetry?: StrWorkflowTelemetry,
): Promise<ResolvedInvestmentMarketContext> {
  const marketSnapshots = new SupabaseStrMarketSnapshotRepository(await createClient());
  const propertySnapshots = new SupabasePropertySnapshotRepository(createAdminClient() as never);
  if (input.marketSnapshotId) {
    return resolveInvestmentMarketContext(input, {
      propertySnapshots,
      marketSnapshots,
      providerVersion: "airroi-api.v1",
      enabled: false,
      telemetry,
    });
  }
  const config = getAirRoiConfig();
  const propertyProvider = process.env.REALTY_API_KEY
    ? createRealtyApiPropertyProvider({
      apiKey: process.env.REALTY_API_KEY,
      ...(process.env.REALTY_API_BASE_URL ? { baseUrl: process.env.REALTY_API_BASE_URL } : {}),
      timeoutMs: config.timeoutMs,
    })
    : undefined;
  const marketProvider = config.enabled && config.apiKey
    ? new AirRoiProvider(new AirRoiClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
    }), config)
    : undefined;

  return resolveInvestmentMarketContext(input, {
    propertyProvider,
    propertySnapshots,
    marketProvider,
    marketSnapshots,
    providerVersion: "airroi-api.v1",
    enabled: config.enabled,
    propertySnapshotTtlDays: config.propertySnapshotTtlDays,
    marketSnapshotTtlDays: config.marketSnapshotTtlDays,
    telemetry,
    classifyMarketFailure(error) {
      if (error instanceof AirRoiError) {
        if (error.code === "rate-limited") return "STR_PROVIDER_RATE_LIMITED";
        if (error.code === "invalid-request" || error.code === "unsupported-geography" || error.code === "not-found") return "STR_REQUEST_REJECTED";
        if (error.code === "invalid-response") return "STR_RESPONSE_INVALID";
      }
      if (error instanceof Error && error.message.startsWith("STR market snapshot persistence failed")) {
        return "MARKET_SNAPSHOT_PERSISTENCE_FAILED";
      }
      return "STR_PROVIDER_UNAVAILABLE";
    },
  });
}

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
  const emit = (event: string, attributes: Record<string, string | number | boolean | undefined> = {}) =>
    telemetry?.emit(event, { correlationId: input.correlationId, ...attributes });
  emit("str_runtime_repository_construction_started");
  const marketSnapshots = new SupabaseStrMarketSnapshotRepository(await createClient());
  const propertySnapshots = new SupabasePropertySnapshotRepository(createAdminClient() as never);
  emit("str_runtime_repository_construction_completed");
  if (input.marketSnapshotId) {
    emit("str_runtime_historical_snapshot_branch_selected");
    return resolveInvestmentMarketContext(input, {
      propertySnapshots,
      marketSnapshots,
      providerVersion: "airroi-api.v1",
      enabled: false,
      telemetry,
    });
  }
  let config;
  try {
    emit("str_runtime_feature_flag_evaluation_started");
    config = getAirRoiConfig();
    emit("str_runtime_feature_flag_evaluation_completed", { featureEnabled: config.enabled });
  } catch (error) {
    telemetry?.emit("str_adapter_activation_failed", {
      correlationId: input.correlationId,
      provider: "airroi",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    config = getAirRoiConfig({ MARKET_INTELLIGENCE_ENABLED: "false" });
    emit("str_runtime_feature_flag_evaluation_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      featureEnabled: false,
    });
  }
  emit("str_runtime_api_key_evaluation_completed", {
    propertyApiKeyConfigured: Boolean(process.env.REALTY_API_KEY?.trim()),
    marketApiKeyConfigured: Boolean(config.apiKey),
  });
  emit("str_runtime_provider_construction_started");
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
      telemetry,
    }), config, () => new Date(), telemetry)
    : undefined;
  emit("str_runtime_provider_construction_completed", {
    propertyProviderConfigured: Boolean(propertyProvider),
    marketProviderConfigured: Boolean(marketProvider),
  });

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

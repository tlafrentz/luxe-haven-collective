"use server";

import { getSessionProfile } from "@/lib/auth/session";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import {
  InvestmentWorkspaceAnalysisError,
  runInvestmentWorkspaceAnalysis,
} from "@/features/investment-intelligence";
import type {
  InvestmentWorkspaceActionResult,
  RunInvestmentWorkspaceAnalysisCommand,
} from "@/features/investment-intelligence";
import { ProviderError, ProviderErrorCode } from "@/features/market-intelligence/application/providers/provider-error";
import { RentCastClient } from "@/features/market-intelligence/infrastructure/rentcast/rentcast-client";
import { RentCastComparableProvider } from "@/features/market-intelligence/infrastructure/rentcast/rentcast-comparable-provider";
import { RentCastPropertyProvider } from "@/features/market-intelligence/infrastructure/rentcast/rentcast-property-provider";
import { getMarketIntelligenceConfig, MarketIntelligenceConfigurationError } from "@/features/market-intelligence/infrastructure/market-intelligence-config";
import { startMarketAnalysisRun, type MarketAnalysisRunRecorder } from "@/features/market-intelligence/infrastructure/provider-diagnostics";
import { investmentWorkspaceActionSchema } from "./investment-workspace-schema";
import {
  assertWorkspaceRateLimit,
  buildCachedMarketProviders,
  buildSuppliedAssumptionMarketProviders,
  coalesceWorkspaceRequest,
  fingerprint,
  InvestmentWorkspaceRateLimitError,
  recordWorkspaceOperation,
  setWorkspaceHealthStatus,
  updateWorkspaceHealth,
} from "./investment-workspace-runtime";
import { storeInvestmentAnalysis } from "./investment-analysis-save-store";

type InvestmentWorkspaceActionInput = Omit<RunInvestmentWorkspaceAnalysisCommand, "context"> & Readonly<{
  clientRequestId: string;
}>;
export type InvestmentWorkspaceServerActionResult = Exclude<InvestmentWorkspaceActionResult, { ok: true }> | Readonly<{ ok: true; result: Extract<InvestmentWorkspaceActionResult, { ok: true }>["result"]; analysisId: string; analysisSaveToken: string; analyzedAt: Date; expiresAt: Date }>;

export async function analyzeInvestmentWorkspace(
  input: InvestmentWorkspaceActionInput,
): Promise<InvestmentWorkspaceServerActionResult> {
  const { user } = await getSessionProfile();
  if (!user) return { ok: false, error: { code: "INVALID_INPUT", message: "Sign in before analyzing an investment.", retryable: false } };
  let workspaceId: string;
  try {
    const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
    if (!["owner", "administrator"].includes(access.role)) return { ok: false, error: { code: "INVALID_INPUT", message: "You are not authorized to analyze investments in this workspace.", retryable: false } };
    workspaceId = access.workspaceId;
  } catch {
    return { ok: false, error: { code: "INVALID_INPUT", message: "You are not authorized to analyze investments in this workspace.", retryable: false } };
  }
  const parsed = investmentWorkspaceActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_INPUT", message: "Review the workspace fields and try again.", retryable: false } };
  }
  const requestedAt = new Date();
  const runId = `MI-${requestedAt.toISOString().replace(/\D/g, "").slice(0, 14)}-${crypto.randomUUID()}`;
  let diagnostics: MarketAnalysisRunRecorder | undefined;
  try {
    diagnostics = await startMarketAnalysisRun({
      runId,
      workspaceId,
      userId: user.id,
      acquisitionRoute: parsed.data.investmentInput.acquisitionType,
      address: `${parsed.data.address.streetAddress}, ${parsed.data.address.city}, ${parsed.data.address.state} ${parsed.data.address.postalCode}`,
      propertyType: parsed.data.investmentInput.property.propertyType,
      startedAt: requestedAt,
    });
    await diagnostics.event("analysis", "started", { route: parsed.data.investmentInput.acquisitionType });
  } catch {
    console.error(JSON.stringify({ event: "market_diagnostics_initialization_failed", runId }));
  }
  let config;
  try { config = getMarketIntelligenceConfig(); } catch (error) {
    setWorkspaceHealthStatus("misconfigured");
    await diagnostics?.complete("failed", "MARKET_PROVIDER_UNAVAILABLE");
    return { ok: false, error: safeError(error) };
  }
  if (!config.providerEnabled) {
    setWorkspaceHealthStatus("disabled");
    await diagnostics?.complete("failed", "MARKET_PROVIDER_DISABLED");
    return { ok: false, error: { code: "MARKET_PROVIDER_DISABLED", message: "Live Market analysis is currently disabled. Your assumptions were preserved.", retryable: false } };
  }
  try { assertWorkspaceRateLimit(user.id, config.rateLimitPerMinute); } catch (error) {
    const safe = safeError(error);
    await diagnostics?.complete("failed", safe.code);
    return { ok: false, error: safe };
  }
  const requestFingerprint = fingerprint({
    actorId: user.id,
    address: parsed.data.address,
    investmentInput: parsed.data.investmentInput,
    userProvidedAssumptionKeys: parsed.data.userProvidedAssumptionKeys,
    marketRequest: parsed.data.marketRequest,
  });
  const startedAt = Date.now();
  recordWorkspaceOperation("started", { workspaceRunId: runId, requestFingerprint: requestFingerprint.slice(0, 16), route: parsed.data.investmentInput.acquisitionType });
  await diagnostics?.event("provider-selection", "completed", { provider: "rentcast", fallback: false });
  try {
    const result = await coalesceWorkspaceRequest(requestFingerprint, async () => {
      const client = new RentCastClient({
        apiKey: config.rentCastApiKey ?? "",
        baseUrl: config.rentCastBaseUrl,
        timeoutMs: config.requestTimeoutMs,
        diagnosticsObserver: diagnostics?.observer,
        acquisitionRoute: parsed.data.investmentInput.acquisitionType,
      });
      const providers = buildCachedMarketProviders(
        new RentCastPropertyProvider({ client }),
        new RentCastComparableProvider({ client }),
        { ttlMs: config.cacheTtlMs, retryCount: config.retryCount },
      );
      const command = {
        address: parsed.data.address,
        investmentInput: parsed.data.investmentInput,
        userProvidedAssumptionKeys: parsed.data.userProvidedAssumptionKeys,
        marketRequest: parsed.data.marketRequest,
        context: {
          workspaceRunId: runId,
          propertyResolutionId: `resolution:${runId}`,
          marketAnalysisId: `market:${runId}`,
          requestedAt,
          requestedBy: user.id,
        },
      };
      try {
        return await runInvestmentWorkspaceAnalysis(command, {
          ...providers,
          onPropertyResolved: propertyId => diagnostics?.setPropertyId(propertyId),
        });
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error;
        await diagnostics?.event("provider-selection", "completed", {
          provider: "manual-supplied-assumptions",
          fallback: true,
          providerErrorCode: error.code,
        });
        return runInvestmentWorkspaceAnalysis(command, {
          ...buildSuppliedAssumptionMarketProviders(command),
          onPropertyResolved: propertyId => diagnostics?.setPropertyId(propertyId),
        });
      }
    });
    const durationMs = Date.now() - startedAt;
    const usedFallback = result.propertyResolution.provenance.some(({ provider }) => provider === "manual");
    updateWorkspaceHealth(usedFallback
      ? { success: false, durationMs, errorCode: "MARKET_PROVIDER_UNAVAILABLE" }
      : { success: true, durationMs });
    recordWorkspaceOperation("completed", { workspaceRunId: runId, requestFingerprint: requestFingerprint.slice(0, 16), route: parsed.data.investmentInput.acquisitionType, durationMs, reportStatus: result.marketReport.status, confidence: result.marketReport.confidence.level, saleComparableCount: result.marketReport.summary.saleComparableCount, rentalComparableCount: result.marketReport.summary.rentalComparableCount, fallback: usedFallback });
    await diagnostics?.event("market-report", "completed", { status: result.marketReport.status });
    await diagnostics?.event("investment-decision", "completed", { route: result.lifecycleResult.acquisitionType });
    const issuedSaveToken = await storeInvestmentAnalysis(user.id, result, {
      address: parsed.data.address,
      investmentInput: parsed.data.investmentInput,
      userProvidedAssumptionKeys: parsed.data.userProvidedAssumptionKeys,
      marketRequest: parsed.data.marketRequest,
    }, requestedAt);
    await diagnostics?.complete("succeeded");
    return { ok: true, result, analysisId: result.lineage.workspaceRunId, analysisSaveToken: issuedSaveToken.token, analyzedAt: requestedAt, expiresAt: issuedSaveToken.expiresAt };
  } catch (error) {
    const safe = safeError(error);
    const durationMs = Date.now() - startedAt;
    updateWorkspaceHealth({ success: false, durationMs, errorCode: safe.code });
    recordWorkspaceOperation("failed", { workspaceRunId: runId, requestFingerprint: requestFingerprint.slice(0, 16), route: parsed.data.investmentInput.acquisitionType, durationMs, errorCode: safe.code });
    await diagnostics?.complete("failed", safe.code);
    return { ok: false, error: safe };
  }
}

function safeError(error: unknown): Extract<InvestmentWorkspaceActionResult, { ok: false }>["error"] {
  if (error instanceof InvestmentWorkspaceAnalysisError) {
    return {
      code: error.code as Extract<InvestmentWorkspaceActionResult, { ok: false }>["error"]["code"],
      message: error.message,
      retryable: false,
      ...(error.alternatives ? { alternatives: error.alternatives } : {}),
    };
  }
  if (error instanceof ProviderError) {
    const rateLimited = error.code === ProviderErrorCode.RateLimited;
    return {
      code: rateLimited ? "MARKET_RATE_LIMITED" : "MARKET_PROVIDER_UNAVAILABLE",
      message: rateLimited
        ? "Market data is temporarily unavailable because the provider request limit was reached. Your assumptions were preserved."
        : "Market data is temporarily unavailable. Your assumptions were preserved and you can retry.",
      retryable: error.retryable || rateLimited,
    };
  }
  if (error instanceof InvestmentWorkspaceRateLimitError) return { code: "WORKSPACE_RATE_LIMITED", message: "Too many analyses were submitted. Wait a moment and try again.", retryable: true };
  if (error instanceof MarketIntelligenceConfigurationError) return { code: "MARKET_PROVIDER_UNAVAILABLE", message: "Current Market evidence is unavailable, so the full decision analysis cannot be completed. Your assumptions were preserved.", retryable: false };
  return {
    code: "UNEXPECTED_ERROR",
    message: "The workspace analysis could not be completed. Your assumptions were preserved.",
    retryable: true,
  };
}

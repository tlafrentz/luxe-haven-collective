"use server";

import { requireRole } from "@/lib/auth/session";
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
import { investmentWorkspaceActionSchema } from "./investment-workspace-schema";
import {
  assertWorkspaceRateLimit,
  buildCachedMarketProviders,
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
export type InvestmentWorkspaceServerActionResult = Exclude<InvestmentWorkspaceActionResult, { ok: true }> | Readonly<{ ok: true; result: Extract<InvestmentWorkspaceActionResult, { ok: true }>["result"]; analysisSaveToken: string; analyzedAt: Date }>;

export async function analyzeInvestmentWorkspace(
  input: InvestmentWorkspaceActionInput,
): Promise<InvestmentWorkspaceServerActionResult> {
  const { user } = await requireRole(["admin", "owner"]);
  const parsed = investmentWorkspaceActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "INVALID_INPUT", message: "Review the workspace fields and try again.", retryable: false } };
  }
  let config;
  try { config = getMarketIntelligenceConfig(); } catch (error) {
    setWorkspaceHealthStatus("misconfigured");
    return { ok: false, error: safeError(error) };
  }
  if (!config.providerEnabled) {
    setWorkspaceHealthStatus("disabled");
    return { ok: false, error: { code: "MARKET_PROVIDER_DISABLED", message: "Live Market analysis is currently disabled. Your assumptions were preserved.", retryable: false } };
  }
  try { assertWorkspaceRateLimit(user.id, config.rateLimitPerMinute); } catch (error) { return { ok: false, error: safeError(error) }; }
  const requestedAt = new Date();
  const runId = crypto.randomUUID();
  const requestFingerprint = fingerprint({
    actorId: user.id,
    address: parsed.data.address,
    investmentInput: parsed.data.investmentInput,
    userProvidedAssumptionKeys: parsed.data.userProvidedAssumptionKeys,
    marketRequest: parsed.data.marketRequest,
  });
  const startedAt = Date.now();
  recordWorkspaceOperation("started", { workspaceRunId: runId, requestFingerprint: requestFingerprint.slice(0, 16), route: parsed.data.investmentInput.acquisitionType });
  try {
    const result = await coalesceWorkspaceRequest(requestFingerprint, async () => {
      const client = new RentCastClient({ apiKey: config.rentCastApiKey ?? "", baseUrl: config.rentCastBaseUrl, timeoutMs: config.requestTimeoutMs });
      const providers = buildCachedMarketProviders(
        new RentCastPropertyProvider({ client }),
        new RentCastComparableProvider({ client }),
        { ttlMs: config.cacheTtlMs, retryCount: config.retryCount },
      );
      return runInvestmentWorkspaceAnalysis({
        address: parsed.data.address,
        investmentInput: parsed.data.investmentInput,
        userProvidedAssumptionKeys: parsed.data.userProvidedAssumptionKeys,
        marketRequest: parsed.data.marketRequest,
        context: {
          workspaceRunId: `workspace:${runId}`,
          propertyResolutionId: `resolution:${runId}`,
          marketAnalysisId: `market:${runId}`,
          requestedAt,
          requestedBy: user.id,
        },
      }, providers);
    });
    const durationMs = Date.now() - startedAt;
    updateWorkspaceHealth({ success: true, durationMs });
    recordWorkspaceOperation("completed", { workspaceRunId: runId, requestFingerprint: requestFingerprint.slice(0, 16), route: parsed.data.investmentInput.acquisitionType, durationMs, reportStatus: result.marketReport.status, confidence: result.marketReport.confidence.level, saleComparableCount: result.marketReport.summary.saleComparableCount, rentalComparableCount: result.marketReport.summary.rentalComparableCount });
    const analysisSaveToken = await storeInvestmentAnalysis(user.id, result, {
      address: parsed.data.address,
      investmentInput: parsed.data.investmentInput,
      userProvidedAssumptionKeys: parsed.data.userProvidedAssumptionKeys,
      marketRequest: parsed.data.marketRequest,
    }, requestedAt);
    return { ok: true, result, analysisSaveToken, analyzedAt: requestedAt };
  } catch (error) {
    const safe = safeError(error);
    const durationMs = Date.now() - startedAt;
    updateWorkspaceHealth({ success: false, durationMs, errorCode: safe.code });
    recordWorkspaceOperation("failed", { workspaceRunId: runId, requestFingerprint: requestFingerprint.slice(0, 16), route: parsed.data.investmentInput.acquisitionType, durationMs, errorCode: safe.code });
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

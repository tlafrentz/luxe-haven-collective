"use server";

import { getSessionProfile } from "@/lib/auth/session";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import {
  InvestmentWorkspaceAnalysisError,
  projectInvestmentWorkspaceTransport,
  runInvestmentWorkspaceAnalysis,
} from "@/features/investment-intelligence";
import type {
  InvestmentWorkspaceAnalysisTransportDto,
  InvestmentWorkspaceActionResult,
  RunInvestmentWorkspaceAnalysisCommand,
} from "@/features/investment-intelligence";
import { ProviderError, ProviderErrorCode } from "@/features/market-intelligence/application/providers/provider-error";
import { startMarketAnalysisRun, type MarketAnalysisRunRecorder } from "@/features/market-intelligence/infrastructure/provider-diagnostics";
import { investmentWorkspaceActionSchema } from "./investment-workspace-schema";
import {
  assertWorkspaceRateLimit,
  buildSuppliedAssumptionMarketProviders,
  coalesceWorkspaceRequest,
  fingerprint,
  InvestmentWorkspaceRateLimitError,
  recordWorkspaceOperation,
  updateWorkspaceHealth,
} from "./investment-workspace-runtime";
import { storeInvestmentAnalysis } from "./investment-analysis-save-store";
import {
  buildAuthorizedMarketSnapshotReference,
  buildMarketSnapshotAnalysisProviders,
  MarketSnapshotAuthorizationError,
} from "@/features/market-intelligence/str/application";
import { resolveInvestmentMarketContextAtRuntime } from "@/features/market-intelligence/str/infrastructure/investment-market-context-runtime";
import type { StrMarketSnapshot } from "@/features/market-intelligence/str/domain";

type InvestmentWorkspaceActionInput = Omit<RunInvestmentWorkspaceAnalysisCommand, "context"> & Readonly<{
  clientRequestId: string;
  marketSnapshotId?: string;
}>;
export type InvestmentWorkspaceServerActionResult = Exclude<InvestmentWorkspaceActionResult, { ok: true }> | Readonly<{ ok: true; result: InvestmentWorkspaceAnalysisTransportDto; analysisId: string; analysisSaveToken: string; analyzedAt: Date; expiresAt: Date }>;

export async function analyzeInvestmentWorkspace(
  input: InvestmentWorkspaceActionInput,
): Promise<InvestmentWorkspaceServerActionResult> {
  console.info(JSON.stringify({
    event: "investment_workspace_action_entered",
    payloadType: typeof input,
  }));
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
  let authorizedMarketSnapshot: StrMarketSnapshot | undefined;
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
  try { assertWorkspaceRateLimit(user.id, 6); } catch (error) {
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
  try {
    const result = await coalesceWorkspaceRequest(requestFingerprint, async () => {
      let marketContext;
      try {
        marketContext = await resolveInvestmentMarketContextAtRuntime({
          ownerId: user.id,
          workspaceId,
          address: `${parsed.data.address.streetAddress}, ${parsed.data.address.city}, ${parsed.data.address.state} ${parsed.data.address.postalCode}`,
          property: {
            propertyType: parsed.data.investmentInput.property.propertyType,
            bedrooms: parsed.data.investmentInput.property.bedrooms,
            bathrooms: parsed.data.investmentInput.property.bathrooms,
          },
          marketSnapshotId: parsed.data.marketSnapshotId,
          correlationId: runId,
          requestedAt,
        }, {
          emit(event, attributes) { console.info(JSON.stringify({ event: canonicalEvent(event), ...attributes })); },
        });
      } catch (error) {
        if (parsed.data.marketSnapshotId || error instanceof MarketSnapshotAuthorizationError) throw error;
        console.warn(JSON.stringify({
          event: "market_snapshot_resolution_failed",
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorCode: providerErrorCode(error),
          correlationId: runId,
        }));
        marketContext = {
          source: "manual-fallback" as const,
          warnings: [`Live market evidence is unavailable (${providerErrorCode(error)}). Supplied assumptions were preserved.`],
        };
      }
      authorizedMarketSnapshot = marketContext.marketSnapshot;
      const snapshotProviders = marketContext.subjectProperty
        ? buildMarketSnapshotAnalysisProviders({
          subjectProperty: marketContext.subjectProperty,
          ...(marketContext.marketSnapshot ? { marketSnapshot: marketContext.marketSnapshot } : {}),
        })
        : undefined;
      const investmentInput = applyMarketSnapshotProposals(
        parsed.data.investmentInput,
        parsed.data.userProvidedAssumptionKeys,
        marketContext.marketSnapshot,
      );
      const command = {
        address: parsed.data.address,
        investmentInput,
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
      const providers = snapshotProviders ?? buildSuppliedAssumptionMarketProviders(command);
      const selection = marketContext.source === "manual-fallback"
        ? "manual-supplied-assumptions"
        : marketContext.source === "persisted-snapshot"
          ? "persisted-market-snapshot"
          : "airroi";
      await diagnostics?.event("provider-selection", "completed", {
        provider: selection,
        propertyProvider: snapshotProviders ? "realtyapi" : "manual-supplied-assumptions",
        fallback: marketContext.source === "manual-fallback",
        warningCount: marketContext.warnings.length,
      });
      console.info(JSON.stringify({
        event: "provider_selection_completed",
        provider: selection,
        propertyProvider: snapshotProviders ? "realtyapi" : "manual-supplied-assumptions",
        fallback: marketContext.source === "manual-fallback",
        correlationId: runId,
      }));
      try {
        console.info(JSON.stringify({ event: "investment_workspace_analysis_started", correlationId: runId }));
        return await runInvestmentWorkspaceAnalysis(command, {
          ...providers,
          onPropertyResolved: propertyId => diagnostics?.setPropertyId(propertyId),
        });
      } catch (error) {
        if (!(error instanceof ProviderError) || !snapshotProviders) throw error;
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
    console.info(JSON.stringify({ event: "investment_workspace_analysis_completed", correlationId: runId }));
    const issuedSaveToken = await storeInvestmentAnalysis(user.id, result, {
      address: parsed.data.address,
      investmentInput: parsed.data.investmentInput,
      userProvidedAssumptionKeys: parsed.data.userProvidedAssumptionKeys,
      marketRequest: parsed.data.marketRequest,
    }, requestedAt, authorizedMarketSnapshot
      ? buildAuthorizedMarketSnapshotReference(authorizedMarketSnapshot, result.lineage.workspaceRunId)
      : undefined);
    if (authorizedMarketSnapshot) console.info("analysis_saved_with_market_snapshot", {
      analysisId: result.lineage.workspaceRunId, marketSnapshotId: authorizedMarketSnapshot.id,
      propertySnapshotId: authorizedMarketSnapshot.subjectPropertySnapshotId, correlationId: runId,
    });
    await diagnostics?.complete("succeeded");
    const response = {
      ok: true as const,
      result: projectInvestmentWorkspaceTransport(result),
      analysisId: result.lineage.workspaceRunId,
      analysisSaveToken: issuedSaveToken.token,
      analyzedAt: requestedAt,
      expiresAt: issuedSaveToken.expiresAt,
    };
    console.info(JSON.stringify({
      event: "investment_workspace_action_completed",
      payloadType: "InvestmentWorkspaceServerActionResult",
      payloadBytes: new TextEncoder().encode(JSON.stringify(response)).byteLength,
    }));
    return response;
  } catch (error) {
    const safe = safeError(error);
    const durationMs = Date.now() - startedAt;
    updateWorkspaceHealth({ success: false, durationMs, errorCode: safe.code });
    recordWorkspaceOperation("failed", { workspaceRunId: runId, requestFingerprint: requestFingerprint.slice(0, 16), route: parsed.data.investmentInput.acquisitionType, durationMs, errorCode: safe.code });
    await diagnostics?.complete("failed", safe.code);
    console.error(JSON.stringify({
      event: "investment_workspace_action_failed",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode: safe.code,
      message: safe.message,
      stage: "analysis",
      correlationId: runId,
    }));
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
  if (error instanceof MarketSnapshotAuthorizationError) return { code: "INVALID_INPUT", message: error.message, retryable: false };
  return {
    code: "UNEXPECTED_ERROR",
    message: "The workspace analysis could not be completed. Your assumptions were preserved.",
    retryable: true,
  };
}

function canonicalEvent(event: string): string {
  return event
    .replace("str_market_snapshot_cache_hit", "market_snapshot_cache_hit")
    .replace("str_market_snapshot_cache_miss", "market_snapshot_cache_miss")
    .replace("str_market_snapshot_created", "market_snapshot_created");
}

function providerErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return error instanceof Error ? error.name : "UNKNOWN";
}

function applyMarketSnapshotProposals<T extends RunInvestmentWorkspaceAnalysisCommand["investmentInput"]>(
  input: T,
  userKeys: readonly string[],
  snapshot?: StrMarketSnapshot,
): T {
  if (!snapshot) return input;
  const estimate = snapshot.revenueEstimate;
  const marketAdr = estimate?.projectedAdr?.amount ?? snapshot.marketMetrics?.adr?.amount;
  const marketOccupancy = estimate?.projectedOccupancy?.value ?? snapshot.marketMetrics?.occupancy?.value;
  const provided = new Set(userKeys);
  return {
    ...input,
    revenue: {
      ...input.revenue,
      ...(!provided.has("projected-adr") && marketAdr !== undefined ? { projectedAdr: marketAdr } : {}),
      ...(!provided.has("projected-occupancy-percentage") && marketOccupancy !== undefined
        ? { projectedOccupancyPercentage: marketOccupancy } : {}),
      confidencePercentage: Math.round(snapshot.confidence.score),
    },
    market: {
      ...input.market,
      ...(!provided.has("market-median-adr") && marketAdr !== undefined ? { medianAdr: marketAdr } : {}),
      ...(!provided.has("market-median-occupancy-percentage") && marketOccupancy !== undefined
        ? { medianOccupancyPercentage: marketOccupancy } : {}),
    },
  } as T;
}

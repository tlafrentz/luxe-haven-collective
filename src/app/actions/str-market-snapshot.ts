"use server";

import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { SupabaseStrMarketSnapshotRepository } from "@/features/market-intelligence/str/infrastructure/str-market-snapshot-repository";
import { authorizeStrMarketSnapshot } from "@/features/market-intelligence/str/application/authorize-str-market-snapshot";
import { createStrMarketIntelligenceService } from "@/features/market-intelligence/str/application/get-str-market-intelligence";
import { AirRoiClient } from "@/features/market-intelligence/str/infrastructure/airroi/airroi-client";
import { getAirRoiConfig } from "@/features/market-intelligence/str/infrastructure/airroi/airroi-config";
import { AirRoiProvider } from "@/features/market-intelligence/str/infrastructure/airroi/airroi-provider";
import { detectMaterialMarketChanges } from "@/features/investment-intelligence/application/market-intelligence-experience";

const id = z.string().uuid();
async function context() {
  const { user } = await getSessionProfile(); if (!user) return null;
  const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
  if (!["owner", "administrator"].includes(access.role)) return null;
  return { userId: user.id, workspaceId: access.workspaceId, repository: new SupabaseStrMarketSnapshotRepository(await createClient()) };
}

export async function refreshStrMarketSnapshotAction(input: unknown) {
  const parsed = z.object({ marketSnapshotId: id, correlationId: z.string().min(1).max(160) }).strict().safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "INVALID_REQUEST", message: "The market refresh request is invalid." };
  const scope = await context(); if (!scope) return { ok: false as const, code: "ACCESS_DENIED", message: "You are not authorized to refresh this evidence." };
  try {
    const current = await authorizeStrMarketSnapshot({ snapshotId: parsed.data.marketSnapshotId, ownerId: scope.userId, workspaceId: scope.workspaceId, property: {} }, scope.repository);
    const config = getAirRoiConfig();
    if (!config.enabled || !config.apiKey) return { ok: false as const, code: "MARKET_DISABLED", message: "Live market refresh is disabled. Historical evidence remains available." };
    console.info("market_snapshot_refresh_requested", { marketSnapshotId: current.id, propertySnapshotId: current.subjectPropertySnapshotId, correlationId: parsed.data.correlationId });
    const provider = new AirRoiProvider(new AirRoiClient({ apiKey: config.apiKey, baseUrl: config.baseUrl, timeoutMs: config.timeoutMs, maxRetries: config.maxRetries }), config);
    const service = createStrMarketIntelligenceService({ provider, repository: scope.repository, providerVersion: current.providerVersion, snapshotTtlDays: config.marketSnapshotTtlDays });
    const refreshed = await service({ ownerId: scope.userId, workspaceId: scope.workspaceId, query: { ...current.query, requestedAt: new Date().toISOString() }, correlationId: parsed.data.correlationId, refresh: true });
    console.info("market_snapshot_refreshed", { marketSnapshotId: refreshed.id, previousMarketSnapshotId: current.id, propertySnapshotId: refreshed.subjectPropertySnapshotId, correlationId: parsed.data.correlationId });
    return { ok: true as const, snapshot: refreshed, changes: detectMaterialMarketChanges(current, refreshed) };
  } catch {
    return { ok: false as const, code: "REFRESH_FAILED", message: "Market evidence could not be refreshed. The previous snapshot was preserved." };
  }
}

export async function compareStrMarketSnapshotsAction(input: unknown) {
  const parsed = z.object({ previousSnapshotId: id, currentSnapshotId: id, correlationId: z.string().min(1).max(160) }).strict().safeParse(input);
  if (!parsed.success) return { ok: false as const, code: "INVALID_REQUEST", message: "The comparison request is invalid." };
  const scope = await context(); if (!scope) return { ok: false as const, code: "ACCESS_DENIED", message: "You are not authorized to compare this evidence." };
  try {
    const [previous, current] = await Promise.all([
      authorizeStrMarketSnapshot({ snapshotId: parsed.data.previousSnapshotId, ownerId: scope.userId, workspaceId: scope.workspaceId, property: {} }, scope.repository),
      authorizeStrMarketSnapshot({ snapshotId: parsed.data.currentSnapshotId, ownerId: scope.userId, workspaceId: scope.workspaceId, property: {} }, scope.repository),
    ]);
    if (previous.subjectPropertyId !== current.subjectPropertyId) return { ok: false as const, code: "INCOMPATIBLE", message: "Only snapshots for the same subject property can be compared." };
    return { ok: true as const, changes: detectMaterialMarketChanges(previous, current) };
  } catch { return { ok: false as const, code: "ACCESS_DENIED", message: "The selected snapshots are unavailable." }; }
}

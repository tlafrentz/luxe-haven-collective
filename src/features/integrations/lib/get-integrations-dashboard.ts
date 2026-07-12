import { createClient } from "@/lib/supabase/server";

import type {
  IntegrationConnectionStatus,
  IntegrationDashboardItem,
  IntegrationHealth,
  IntegrationSyncHistoryItem,
  IntegrationSyncRunStatus,
  IntegrationsDashboardData,
  SyncSummary,
} from "../types";

type ConnectionRow = {
  id: string;
  provider: string;
  status: string;
  last_synced_at: string | null;
};

type SyncRunRow = {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_processed: number | null;
  records_created: number | null;
  records_updated: number | null;
  records_failed: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

function mapConnectionStatus(
  status: string,
): IntegrationConnectionStatus {
  switch (status) {
    case "active":
      return "connected";
    case "paused":
      return "paused";
    case "error":
      return "error";
    default:
      return "disconnected";
  }
}

function mapSyncRunStatus(
  status: string,
): IntegrationSyncRunStatus {
  switch (status) {
    case "running":
      return "running";
    case "partial":
      return "partial";
    case "failed":
      return "failed";
    default:
      return "completed";
  }
}

function mapHealth({
  connectionStatus,
  latestSyncStatus,
}: {
  connectionStatus: IntegrationConnectionStatus;
  latestSyncStatus?: string | null;
}): IntegrationHealth {
  if (connectionStatus === "error") {
    return "error";
  }

  if (latestSyncStatus === "failed") {
    return "error";
  }

  if (latestSyncStatus === "partial") {
    return "warning";
  }

  if (latestSyncStatus === "running") {
    return "syncing";
  }

  return "healthy";
}

function getSkippedCount(
  metadata: Record<string, unknown> | null,
): number {
  const value = metadata?.skipped;

  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : 0;
}

function calculateDurationMs({
  startedAt,
  completedAt,
}: {
  startedAt: string;
  completedAt: string | null;
}): number {
  if (!completedAt) {
    return 0;
  }

  const started = new Date(startedAt).getTime();
  const completed = new Date(completedAt).getTime();

  if (
    !Number.isFinite(started) ||
    !Number.isFinite(completed)
  ) {
    return 0;
  }

  return Math.max(0, completed - started);
}

function mapSyncHistoryItem(
  syncRun: SyncRunRow,
): IntegrationSyncHistoryItem {
  return {
    id: syncRun.id,
    status: mapSyncRunStatus(syncRun.status),
    startedAt: syncRun.started_at,
    completedAt: syncRun.completed_at,
    durationMs: calculateDurationMs({
      startedAt: syncRun.started_at,
      completedAt: syncRun.completed_at,
    }),
    processed: syncRun.records_processed ?? 0,
    created: syncRun.records_created ?? 0,
    updated: syncRun.records_updated ?? 0,
    skipped: getSkippedCount(
      syncRun.metadata,
    ),
    failed: syncRun.records_failed ?? 0,
    errorMessage: syncRun.error_message,
  };
}

function mapSyncSummary(
  syncRun: IntegrationSyncHistoryItem | null,
): SyncSummary | null {
  if (!syncRun) {
    return null;
  }

  return {
    provider: "hospitable",
    health:
      syncRun.status === "failed"
        ? "error"
        : syncRun.status === "partial"
          ? "warning"
          : syncRun.status === "running"
            ? "syncing"
            : "healthy",
    processed: syncRun.processed,
    created: syncRun.created,
    updated: syncRun.updated,
    skipped: syncRun.skipped,
    failed: syncRun.failed,
    durationMs: syncRun.durationMs,
    completedAt:
      syncRun.completedAt ??
      syncRun.startedAt,
  };
}

async function getHospitableDashboardItem(): Promise<
  IntegrationDashboardItem
> {
  const supabase = await createClient();

  const {
    data: connection,
    error: connectionError,
  } = await supabase
    .from("integration_connections")
    .select(
      "id, provider, status, last_synced_at",
    )
    .eq("provider", "hospitable")
    .maybeSingle();

  if (connectionError) {
    throw new Error(
      `Unable to load Hospitable connection: ${connectionError.message}`,
    );
  }

  if (!connection) {
    return {
      id: "hospitable",
      provider: "hospitable",
      displayName: "Hospitable",
      description:
        "Sync properties and reservations from Hospitable.",
      connectionStatus: "disconnected",
      health: "warning",
      propertyCount: 0,
      reservationCount: 0,
      lastSyncedAt: null,
      lastSync: null,
      syncHistory: [],
    };
  }

  const typedConnection =
    connection as ConnectionRow;

  const [
    propertyCountResult,
    reservationCountResult,
    syncHistoryResult,
  ] = await Promise.all([
    supabase
      .from("external_properties")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq(
        "connection_id",
        typedConnection.id,
      )
      .not("property_id", "is", null),

    supabase
      .from("bookings")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq(
        "external_provider",
        "hospitable",
      ),

    supabase
      .from("integration_sync_runs")
      .select(
        `
          id,
          status,
          started_at,
          completed_at,
          records_processed,
          records_created,
          records_updated,
          records_failed,
          error_message,
          metadata
        `,
      )
      .eq(
        "connection_id",
        typedConnection.id,
      )
      .eq(
        "sync_type",
        "reservations",
      )
      .order("started_at", {
        ascending: false,
      })
      .limit(8),
  ]);

  if (propertyCountResult.error) {
    throw new Error(
      `Unable to count linked properties: ${propertyCountResult.error.message}`,
    );
  }

  if (reservationCountResult.error) {
    throw new Error(
      `Unable to count synchronized reservations: ${reservationCountResult.error.message}`,
    );
  }

  if (syncHistoryResult.error) {
    throw new Error(
      `Unable to load sync history: ${syncHistoryResult.error.message}`,
    );
  }

  const syncHistory = (
    (syncHistoryResult.data ?? []) as SyncRunRow[]
  ).map(mapSyncHistoryItem);

  const latestSync =
    syncHistory[0] ?? null;

  const connectionStatus =
    mapConnectionStatus(
      typedConnection.status,
    );

  return {
    id: typedConnection.id,
    provider: "hospitable",
    displayName: "Hospitable",
    description:
      "Sync properties, reservations, guest details, and financials from Hospitable.",
    connectionStatus,
    health: mapHealth({
      connectionStatus,
      latestSyncStatus:
        latestSync?.status ?? null,
    }),
    propertyCount:
      propertyCountResult.count ?? 0,
    reservationCount:
      reservationCountResult.count ?? 0,
    lastSyncedAt:
      typedConnection.last_synced_at,
    lastSync:
      mapSyncSummary(latestSync),
    syncHistory,
  };
}

export async function getIntegrationsDashboard(): Promise<IntegrationsDashboardData> {
  const integrations = [
    await getHospitableDashboardItem(),
  ];

  return {
    integrations,
    generatedAt:
      new Date().toISOString(),
  };
}

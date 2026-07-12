import type {
  IntegrationHealth,
  IntegrationProvider,
  SyncSummary,
} from "./sync";

export type IntegrationConnectionStatus =
  | "connected"
  | "disconnected"
  | "paused"
  | "error";

export type IntegrationSyncRunStatus =
  | "running"
  | "completed"
  | "partial"
  | "failed";

export type IntegrationSyncHistoryItem = {
  id: string;
  status: IntegrationSyncRunStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errorMessage: string | null;
};

export type IntegrationDashboardItem = {
  id: string;
  provider: IntegrationProvider;
  displayName: string;
  description: string;
  connectionStatus: IntegrationConnectionStatus;
  health: IntegrationHealth;
  propertyCount: number;
  reservationCount: number;
  lastSyncedAt: string | null;
  lastSync: SyncSummary | null;
  syncHistory: IntegrationSyncHistoryItem[];
};

export type IntegrationsDashboardData = {
  integrations: IntegrationDashboardItem[];
  generatedAt: string;
};

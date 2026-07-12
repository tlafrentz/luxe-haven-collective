export type IntegrationProvider =
  | "hospitable"
  | "pricelabs"
  | "wheelhouse"
  | "quickbooks"
  | "stripe";

export type IntegrationHealth =
  | "healthy"
  | "warning"
  | "error"
  | "syncing";

export type SyncSummary = {
  provider: IntegrationProvider;

  health: IntegrationHealth;

  processed: number;

  created: number;

  updated: number;

  skipped: number;

  failed: number;

  durationMs: number;

  completedAt: string;
};

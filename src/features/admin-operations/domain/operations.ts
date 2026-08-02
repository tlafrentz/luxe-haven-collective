import type { ConfigurationStatus, IntegrationId, RuntimeStatus } from "./integration-registry";

export type SyncStatus = "queued" | "running" | "succeeded" | "partially_succeeded" | "failed" | "cancelled";
export type SyncAttempt = Readonly<{ id:string; correlationId:string; integrationId:IntegrationId; capability:string; trigger:"scheduled"|"manual"|"webhook"|"workflow"; direction:"inbound"|"outbound"|"bidirectional"; status:SyncStatus; startedAt:string; completedAt?:string; durationMs?:number; recordsExamined?:number; recordsCreated?:number; recordsUpdated?:number; recordsSkipped?:number; recordsFailed?:number; failureClassification?:string; safeFailureMessage?:string }>;
export type HealthOutcome = "success" | "failure" | "timeout";
export type ProviderHealthObservation = Readonly<{ id:string; integrationId:IntegrationId; capability?:string; observedAt:string; outcome:HealthOutcome; latencyMs?:number; failureClassification?:string; source:"active_check"|"provider_request"|"webhook"|"sync" }>;
export type ProviderHealthStatus = "operational"|"degraded"|"partial_outage"|"outage"|"unknown";
export type AdminAuditEvent = Readonly<{ id:string; occurredAt:string; actorId?:string; actorRole?:string; action:string; category:string; targetType?:string; targetId?:string; result:"succeeded"|"failed"|"denied"; correlationId?:string; source:"admin_ui"|"server_action"|"api"|"webhook"|"system"; metadata:Record<string,string|number|boolean|null> }>;
export type IntegrationOperationalRecord = Readonly<{ id:IntegrationId; configurationStatus:ConfigurationStatus; runtimeStatus:RuntimeStatus; lastSuccessfulActivity?:string; lastFailedActivity?:string; recentSuccessRate?:number; relatedCount?:number }>;

export function calculateHealth(observations: readonly ProviderHealthObservation[]): ProviderHealthStatus {
  if (!observations.length) return "unknown";
  const successes = observations.filter((item) => item.outcome === "success").length;
  const rate = successes / observations.length;
  if (rate >= .99) return "operational";
  if (rate >= .9) return "degraded";
  if (rate >= .5) return "partial_outage";
  return "outage";
}

export function calculateSuccessRate(statuses: readonly SyncStatus[]): number | undefined {
  const terminal = statuses.filter((value) => !["queued","running","cancelled"].includes(value));
  if (!terminal.length) return undefined;
  return Math.round((terminal.filter((value) => value === "succeeded").length / terminal.length) * 1000) / 10;
}

const forbiddenMetadata = /(secret|token|key|payload|message|note|address|email|phone|amount|financial|body|content)/i;
export function sanitizeAuditMetadata(input: Readonly<Record<string, unknown>>): Record<string,string|number|boolean|null> {
  return Object.fromEntries(Object.entries(input).filter(([key, value]) => !forbiddenMetadata.test(key) && (value === null || ["string","number","boolean"].includes(typeof value))).map(([key,value]) => [key,value as string|number|boolean|null]));
}

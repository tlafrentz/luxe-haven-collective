export type WorkspacePropertyStatus =
  | "active" | "setup-required" | "attention-needed"
  | "degraded" | "inactive" | "archived";
export type PropertyInclusionState = "included" | "excluded" | "archived";
export type ProviderLinkageState =
  | "linked" | "unlinked" | "potential-match" | "conflict"
  | "disconnected" | "unknown";
export type ConnectedSystemStatus =
  | "connected" | "attention-needed" | "degraded" | "disconnected"
  | "authorization-expired" | "never-connected" | "syncing";

export type ProviderPropertyLinkSummary = Readonly<{
  referenceId: string;
  connectionId: string;
  provider: string;
  externalPropertyId: string;
  externalPropertyName?: string;
  state: ProviderLinkageState;
  lastObservedAt?: string;
}>;

export type WorkspacePropertySummary = Readonly<{
  propertyId: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  location?: string;
  timezone?: string;
  timezoneSource: "property-override" | "organization-default" | "missing";
  status: WorkspacePropertyStatus;
  inclusion: PropertyInclusionState;
  providerLinks: readonly ProviderPropertyLinkSummary[];
  synchronization: Readonly<{ status: string; lastSuccessfulAt?: string; stale: boolean }>;
  dataQuality: Readonly<{ status: string; issueCount: number }>;
  accessSummary: Readonly<{ allPropertyMembers: number; assignedMembers: number }>;
  updatedAt: string;
}>;

export type ConnectedSystemSummary = Readonly<{
  connectionId: string;
  workspaceId: string;
  provider: "hospitable";
  providerLabel: string;
  status: ConnectedSystemStatus;
  accountLabel?: string;
  connectedAt?: string;
  lastSuccessfulSyncAt?: string;
  lastAttemptAt?: string;
  propertyCount: number;
  linkedPropertyCount: number;
  attentionPropertyCount: number;
  synchronization: Readonly<{
    status: "never-run" | "in-progress" | "succeeded" | "partially-succeeded" | "failed" | "skipped";
    processed: number;
    updated: number;
    failed: number;
  }>;
  capabilities: readonly Readonly<{ name: string; status: "available" | "partially-available" | "unavailable" | "not-supported" }>[];
  issues: readonly string[];
}>;

export type PropertiesAndSystemsHealth = Readonly<{
  state: "healthy" | "attention-needed" | "degraded" | "setup-required";
  propertiesConfigured: number;
  propertiesLinked: number;
  connectedSystemsHealthy: number;
  synchronizationCurrent: boolean;
  operationalDataUsable: boolean;
}>;

export function evaluatePropertyOperationalReadiness(input: Readonly<{
  canonicalStatus: string;
  inclusion: PropertyInclusionState;
  linkage: ProviderLinkageState;
  syncStatus: string;
  qualityStatus: string;
  timezone?: string;
}>): WorkspacePropertyStatus {
  if (input.inclusion === "archived" || input.canonicalStatus === "archived") return "archived";
  if (input.inclusion === "excluded" || input.canonicalStatus === "paused") return "inactive";
  if (!input.timezone || ["unlinked", "unknown", "potential-match"].includes(input.linkage)) return "setup-required";
  if (input.linkage === "conflict" || input.syncStatus === "partially-succeeded") return "attention-needed";
  if (input.linkage === "disconnected" || input.syncStatus === "failed" || ["degraded", "unusable"].includes(input.qualityStatus)) return "degraded";
  return "active";
}

export function mapConnectedSystemStatus(input: Readonly<{
  connectionStatus?: string;
  syncStatus?: string;
  linked: number;
  discovered: number;
}>): ConnectedSystemStatus {
  if (!input.connectionStatus) return "never-connected";
  if (input.connectionStatus === "authorization-expired") return "authorization-expired";
  if (input.connectionStatus === "paused" || input.connectionStatus === "disconnected") return "disconnected";
  if (input.syncStatus === "running" || input.syncStatus === "in-progress") return "syncing";
  if (input.syncStatus === "failed") return "degraded";
  if (input.syncStatus === "partial" || input.linked < input.discovered) return "attention-needed";
  return "connected";
}

export function buildPropertiesAndSystemsHealth(
  properties: readonly WorkspacePropertySummary[],
  systems: readonly ConnectedSystemSummary[],
): PropertiesAndSystemsHealth {
  const included = properties.filter(({ inclusion }) => inclusion === "included");
  const linked = included.filter(({ providerLinks }) => providerLinks.some(({ state }) => state === "linked"));
  const degraded = included.some(({ status }) => status === "degraded") || systems.some(({ status }) => status === "degraded" || status === "authorization-expired");
  const attention = included.some(({ status }) => status === "attention-needed" || status === "setup-required") || systems.some(({ status }) => status === "attention-needed" || status === "disconnected");
  return Object.freeze({
    state: !properties.length ? "setup-required" : degraded ? "degraded" : attention ? "attention-needed" : "healthy",
    propertiesConfigured: included.length,
    propertiesLinked: linked.length,
    connectedSystemsHealthy: systems.filter(({ status }) => status === "connected").length,
    synchronizationCurrent: systems.length > 0 && systems.every(({ status }) => status === "connected"),
    operationalDataUsable: included.every(({ dataQuality }) => dataQuality.status !== "unusable"),
  });
}

export function potentialMatchAllowed(input: Readonly<{ stableExternalId?: string; explicitConfirmation: boolean }>) {
  return Boolean(input.stableExternalId && input.explicitConfirmation);
}

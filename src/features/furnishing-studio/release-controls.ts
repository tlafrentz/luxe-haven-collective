export const RELEASE_CAPABILITIES = ["catalog_viewing", "design_workspace", "budgeting", "procurement_readiness"] as const;
export type ReleaseCapability = (typeof RELEASE_CAPABILITIES)[number];
export type VerificationState = "unverified" | "verified" | "failed";
export type CapabilityProjection = Readonly<{ capability: ReleaseCapability; enabled: boolean; verification: VerificationState; version: number; lastChangedAt?: string; lastActor?: string }>;
export type ReleaseContext = Readonly<{ cohortActive: boolean; suspended: boolean; policyCurrent: boolean; versionCurrent: boolean; workspaceValid: boolean; capabilities: readonly CapabilityProjection[] }>;
export type ContextualAction = "enable" | "verify" | "view" | "disable" | "review_recovery" | null;

export const capabilityLabel = (value: ReleaseCapability) => ({ catalog_viewing: "Catalog viewing", design_workspace: "Design Workspace", budgeting: "Budgeting", procurement_readiness: "Procurement readiness" })[value];

export function prerequisiteFor(capability: ReleaseCapability, context: ReleaseContext): string | null {
  if (context.suspended) return "The controlled release is suspended. Complete governed recovery first.";
  if (!context.workspaceValid) return "Select an eligible controlled workspace.";
  if (!context.cohortActive) return "The controlled cohort is inactive or expired.";
  if (!context.policyCurrent) return "The governing release policy must be reconciled.";
  if (!context.versionCurrent) return "Refresh the authoritative release state.";
  const index = RELEASE_CAPABILITIES.indexOf(capability);
  const predecessor = index > 0 ? context.capabilities.find((item) => item.capability === RELEASE_CAPABILITIES[index - 1]) : undefined;
  return predecessor && (!predecessor.enabled || predecessor.verification !== "verified") ? `${capabilityLabel(predecessor.capability)} must be enabled and verified first.` : null;
}

export function contextualActionFor(item: CapabilityProjection, context: ReleaseContext): ContextualAction {
  if (context.suspended) return "review_recovery";
  if (!item.enabled) return prerequisiteFor(item.capability, context) ? null : "enable";
  if (item.verification !== "verified") return "verify";
  return "view";
}

export function rollbackBlocker(capability: ReleaseCapability, capabilities: readonly CapabilityProjection[]): string | null {
  const index = RELEASE_CAPABILITIES.indexOf(capability);
  const dependent = RELEASE_CAPABILITIES.slice(index + 1).reverse().find((name) => capabilities.find((item) => item.capability === name)?.enabled);
  return dependent ? `${capabilityLabel(dependent)} must be disabled first.` : null;
}

export function stateLabel(item: CapabilityProjection, context: ReleaseContext) {
  if (context.suspended) return "Suspended";
  if (!item.enabled) return prerequisiteFor(item.capability, context) ? "Locked" : "Ready";
  if (item.verification === "failed") return "Failed safely";
  if (item.verification === "unverified") return "Verification required";
  return "Verified";
}

export function releaseSafetyState(input: Readonly<{ globalKillSwitch: boolean; suspended: boolean; recoveryRequired: boolean; available: boolean }>) {
  if (!input.available) return "State unavailable";
  if (input.recoveryRequired) return "Recovery required";
  if (input.suspended) return "Suspended";
  return input.globalKillSwitch ? "Protected" : "Active";
}

export function validateControlReason(reason: string): string | null {
  const value = reason.trim();
  if (value.length < 12) return "Provide a meaningful reason of at least 12 characters.";
  if (value.length > 500) return "Reason must be 500 characters or fewer.";
  return /[<>]/.test(value) ? "Reason must be plain text." : null;
}

export function confirmationLabel(action: "enable" | "disable" | "verify", capability: ReleaseCapability, workspaceName: string) {
  const verb = action === "enable" ? "Enable" : action === "disable" ? "Disable" : "Verify";
  return `${verb} ${capabilityLabel(capability)} for ${workspaceName}`;
}

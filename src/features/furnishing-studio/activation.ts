export type FurnishingGlobalState = "disabled" | "internal" | "limited" | "enabled" | "paused";
export type FurnishingDecisionReason =
  | "enabled"
  | "disabled_globally"
  | "killed_globally"
  | "workspace_disabled"
  | "workspace_not_enabled"
  | "not_in_cohort"
  | "cohort_expired"
  | "capability_disabled"
  | "offer_inactive"
  | "catalog_unavailable"
  | "entitlement_required"
  | "unauthorized"
  | "configuration_invalid";

export type FurnishingActivationContext = Readonly<{
  globalKillSwitch: boolean;
  globalState: FurnishingGlobalState;
  workspaceKillSwitch: boolean;
  workspaceEnabled: boolean;
  cohortEligible: boolean;
  cohortExpired?: boolean;
  capabilityEnabled: boolean;
  offerActive?: boolean;
  catalogAvailable?: boolean;
  actorRole?: "admin" | "owner" | "administrator" | "operator" | "contributor";
  tenantRelationship?: "own" | "member" | "wrong_tenant" | "none";
  entitlementRequired?: boolean;
  entitlementActive?: boolean;
  configurationValid: boolean;
  policyVersion: string;
  evaluatedAt?: string;
}>;

export type FurnishingActivationDecision = Readonly<{
  allowed: boolean;
  reason: DecisionReason;
  policyVersion: string;
  evaluatedAt: string;
}>;

type DecisionReason = FurnishingDecisionReason;

/** Canonical server-side policy. Lower controls are never evaluated as overrides. */
export function resolveFurnishingActivation(
  context: FurnishingActivationContext,
): FurnishingActivationDecision {
  const evaluatedAt = context.evaluatedAt ?? new Date().toISOString();
  let reason: DecisionReason = "enabled";
  if (!context.configurationValid) reason = "configuration_invalid";
  else if (context.globalKillSwitch) reason = "killed_globally";
  else if (context.globalState === "disabled") reason = "disabled_globally";
  else if (context.workspaceKillSwitch) reason = "killed_globally";
  else if (!context.workspaceEnabled) reason = "workspace_not_enabled";
  else if (context.cohortExpired) reason = "cohort_expired";
  else if (!context.cohortEligible) reason = "not_in_cohort";
  else if (!context.capabilityEnabled) reason = "capability_disabled";
  else if (context.offerActive === false) reason = "offer_inactive";
  else if (context.catalogAvailable === false) reason = "catalog_unavailable";
  else if (!context.actorRole || !context.tenantRelationship || context.tenantRelationship === "wrong_tenant" || context.tenantRelationship === "none") reason = "unauthorized";
  else if (context.entitlementRequired && !context.entitlementActive) reason = "entitlement_required";
  return Object.freeze({ allowed: reason === "enabled", reason, policyVersion: context.policyVersion, evaluatedAt });
}

/** FS-008A safe ceiling: every activation/effect mutation is denied. */
export function assertFurnishingActivationMutationDisabled(): void {
  throw new Error("FURNISHING_ACTIVATION_DISABLED");
}

import { cache } from "react";
import {
  evaluateWorkspaceReadiness,
  getEffectiveWorkspaceSettings,
  getOrganizationProfile,
  getPropertiesAndSystemsOverview,
  resolveWorkspaceAccessContext,
  SupabaseNotificationsPreferencesRepository,
  SupabaseOrganizationRepository,
  SupabasePropertiesSystemsRepository,
  SupabaseTeamAccessRepository,
  type PropertiesAndSystemsOverview,
  type WorkspacePrincipal,
} from "@/features/workspace";
import { createClient } from "@/lib/supabase/server";
import { computeSetupProgress } from "../domain/setup-steps";

const EMPTY_PROPERTY_SYSTEMS_OVERVIEW: PropertiesAndSystemsOverview = Object.freeze({
  properties: [],
  systems: [],
  activity: [],
  health: Object.freeze({
    state: "setup-required",
    propertiesConfigured: 0,
    propertiesLinked: 0,
    connectedSystemsHealthy: 0,
    synchronizationCurrent: false,
    operationalDataUsable: false,
  }),
});

export const loadSetupContext = cache(async function loadSetupContext(
  userId: string,
  displayName: string | null,
) {
  const team = new SupabaseTeamAccessRepository();
  const context = await resolveWorkspaceAccessContext(team, userId);
  const principal: WorkspacePrincipal = { profileId: userId, role: context.role, displayName };
  const identity = { profileId: userId, ownerId: context.ownerId, workspaceId: context.workspaceId };

  const [organization, members, invitations, propertySystems, settings] = await Promise.all([
    getOrganizationProfile(new SupabaseOrganizationRepository(), principal, identity),
    team.members(context),
    team.invitations(context),
    // Falls back to an empty overview rather than taking out the entire setup
    // wizard shell (every /dashboard/setup/* page depends on this via the
    // shared layout) if the operational-surface read fails downstream — e.g.
    // the known pre-existing permission gap on public.guests for brand-new
    // workspaces. Steps that need real property data still surface as
    // incomplete; they just don't crash the pages that don't need it.
    getPropertiesAndSystemsOverview(new SupabasePropertiesSystemsRepository(), context).catch(
      () => EMPTY_PROPERTY_SYSTEMS_OVERVIEW,
    ),
    getEffectiveWorkspaceSettings(new SupabaseNotificationsPreferencesRepository(), context),
  ]);

  const system = propertySystems.systems[0];
  const health = evaluateWorkspaceReadiness({
    workspaceId: context.workspaceId,
    role: context.role,
    identityValid: Boolean(context.ownerId && context.membershipId),
    activeOwnerCount: members.filter((m) => m.role === "owner" && m.status === "active").length,
    organizationRequiredComplete: organization.completeness.missingRequired.length === 0,
    organizationConfirmed: ["displayName", "timezone", "currency", "language", "country"].every((field) =>
      organization.confirmedFields.includes(field),
    ),
    includedProperties: propertySystems.health.propertiesConfigured,
    invalidPropertyOwnership: false,
    propertySetupIssues: propertySystems.properties.filter((p) =>
      ["setup-required", "attention-needed"].includes(p.status),
    ).length,
    connectionRequired: true,
    connectionStatus: system?.status ?? "never-connected",
    firstSyncComplete: Boolean(system?.lastSuccessfulSyncAt),
    operationalQuality: propertySystems.properties.some((p) =>
      ["degraded", "unusable"].includes(p.dataQuality.status),
    )
      ? "degraded"
      : "trusted",
    operationalSync: system?.synchronization.status ?? "never-run",
    criticalNotificationsAvailable: settings.notifications.channels.inApp || settings.notifications.channels.email,
    notificationsConfirmed: settings.notifications.confirmed,
    preferencesValid: Boolean(settings.preferences.locale),
  });

  const supabase = await createClient();
  const { data: onboardingRow } = await supabase
    .from("workspace_onboarding")
    .select("skipped_steps")
    .eq("workspace_id", context.workspaceId)
    .maybeSingle<{ skipped_steps: string[] }>();
  const skippedSteps = onboardingRow?.skipped_steps ?? [];

  const progress = computeSetupProgress(health, skippedSteps);

  return {
    context,
    principal,
    identity,
    organization,
    members,
    invitations,
    propertySystems,
    settings,
    health,
    skippedSteps,
    progress,
  };
});

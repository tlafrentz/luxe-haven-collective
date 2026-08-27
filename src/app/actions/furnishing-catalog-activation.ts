import "server-only";

import { resolveFurnishingActivation } from "@/features/furnishing-studio/activation";
import { createClient } from "@/lib/supabase/server";

export async function assertFurnishingCatalogMutationAllowed(
  workspaceId: string,
): Promise<void> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      workspaceId,
    )
  )
    throw new Error("FURNISHING_ACTIVATION_TARGET_INVALID");
  const client = await createClient();
  const { data: release, error: releaseError } = await client
    .from("furnishing_activation_releases")
    .select(
      "id,global_state,global_kill_switch,configuration_valid,policy_version",
    )
    .eq("milestone", "FS-008A")
    .maybeSingle();
  if (releaseError || !release)
    throw new Error("FURNISHING_ACTIVATION_DISABLED");
  const now = new Date().toISOString();
  const [
    { data: workspace, error: workspaceError },
    { data: capability, error: capabilityError },
  ] = await Promise.all([
    client
      .from("furnishing_activation_workspaces")
      .select("enabled,kill_switch,cohort,expires_at,revoked_at")
      .eq("release_id", release.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    client
      .from("furnishing_activation_capabilities")
      .select("enabled")
      .eq("release_id", release.id)
      .eq("capability", "catalog_viewing")
      .maybeSingle(),
  ]);
  if (workspaceError || capabilityError)
    throw new Error("FURNISHING_ACTIVATION_DISABLED");
  const decision = resolveFurnishingActivation({
    globalKillSwitch: release.global_kill_switch,
    globalState: release.global_state,
    workspaceKillSwitch: workspace?.kill_switch ?? true,
    workspaceEnabled: workspace?.enabled ?? false,
    cohortEligible:
      workspace?.cohort === "internal" && !workspace.revoked_at,
    cohortExpired: Boolean(
      workspace?.expires_at && workspace.expires_at <= now,
    ),
    capabilityEnabled: capability?.enabled ?? false,
    actorRole: "admin",
    tenantRelationship: "member",
    configurationValid: release.configuration_valid,
    policyVersion: release.policy_version,
  });
  if (!decision.allowed) throw new Error("FURNISHING_ACTIVATION_DISABLED");
}

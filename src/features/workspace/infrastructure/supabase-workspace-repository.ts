import { getOperationalSurfaceProjection } from "@/features/operational-surfaces";
import { createClient } from "@/lib/supabase/server";

import type {
  ResolvedWorkspaceIdentity,
  WorkspaceRepository,
} from "../application/workspace-services";
import type { WorkspaceIdentity } from "../domain/workspace";

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  async resolveIdentity(profileId: string): Promise<ResolvedWorkspaceIdentity> {
    const supabase = await createClient();
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_memberships")
      .select("workspace_id")
      .eq("profile_id", profileId)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError && membershipError.code !== "42P01") {
      throw new Error(`Unable to resolve workspace membership: ${membershipError.message}`);
    }
    if (membership?.workspace_id) {
      return Object.freeze({
        profileId,
        ownerId: membership.workspace_id,
        workspaceId: membership.workspace_id,
      });
    }
    const { data, error } = await supabase
      .from("owners")
      .select("id, profile_id")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error) throw new Error(`Unable to resolve workspace owner: ${error.message}`);
    return Object.freeze({
      profileId,
      ownerId: data?.id ?? null,
      workspaceId: data?.id ?? null,
    });
  }

  async initializeOwner(profileId: string): Promise<WorkspaceIdentity> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("initialize_workspace_owner");
    if (error) throw new Error(`Unable to initialize workspace owner: ${error.message}`);
    if (typeof data !== "string") {
      throw new Error("Workspace initialization returned an invalid owner identity.");
    }
    return Object.freeze({ profileId, ownerId: data, workspaceId: data });
  }

  async getOperationalProjection(
    identity: WorkspaceIdentity,
    workspaceLabel: string,
  ) {
    return getOperationalSurfaceProjection({
      principal: {
        userId: identity.profileId,
        workspaceId: identity.profileId,
        role: "owner",
      },
      workspaceLabel,
    });
  }
}

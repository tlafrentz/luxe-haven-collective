import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/auth/roles";

export async function requireReleaseControlAccess(
  permission: string,
  workspaceId?: string,
) {
  const { user, profile } = await requireUser();
  if (
    profile?.role === "admin" &&
    !["workspace_recover", "global_recover"].includes(permission)
  )
    return { user, profile };
  const { data } = await (
    await createClient()
  ).rpc("fsux8_has_release_permission", {
    p_actor: user.id,
    p_permission: permission,
    p_workspace: workspaceId ?? null,
  });
  if (data !== true) redirect(roleHome[profile?.role ?? "guest"]);
  return { user, profile };
}

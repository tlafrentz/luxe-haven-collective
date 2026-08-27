import "server-only";

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
  const { data, error } = await client.rpc(
    "authorize_controlled_furnishing_catalog_mutation" as never,
    { p_workspace_id: workspaceId } as never,
  );
  const result = data as Readonly<{
    allowed?: boolean;
    workspaceId?: string;
  }> | null;
  if (error || !result?.allowed || result.workspaceId !== workspaceId)
    throw new Error("FURNISHING_ACTIVATION_DISABLED");
}

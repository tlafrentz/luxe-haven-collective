import { createAdminClient } from "@/lib/supabase/admin";

const PROVIDER = "hospitable";

export type MessagingWorkspace = Readonly<{
  connectionId: string;
  workspaceId: string;
}>;

export async function resolveHospitableMessagingWorkspace(input: Readonly<{
  connectionId?: string;
  workspaceId?: string;
  propertyId?: string;
}> = {}): Promise<MessagingWorkspace> {
  const admin = createAdminClient();
  let query = admin
    .from("integration_connections")
    .select("id,workspace_id")
    .eq("provider", PROVIDER);
  if (input.connectionId) query = query.eq("id", input.connectionId);
  if (input.workspaceId) query = query.eq("workspace_id", input.workspaceId);
  const { data: connection, error } = await query.maybeSingle();
  if (error) throw new Error(`Unable to resolve the Hospitable messaging workspace: ${error.message}`);
  if (!connection?.workspace_id) throw new Error("hospitable_messaging_workspace_unresolved");

  if (input.propertyId) {
    const { data: propertyLink, error: propertyError } = await admin
      .from("external_properties")
      .select("id")
      .eq("connection_id", connection.id)
      .eq("workspace_id", connection.workspace_id)
      .eq("property_id", input.propertyId)
      .eq("provider", PROVIDER)
      .maybeSingle();
    if (propertyError) throw new Error(`Unable to validate the Hospitable messaging workspace: ${propertyError.message}`);
    if (!propertyLink) throw new Error("hospitable_messaging_property_scope_mismatch");
  }

  return Object.freeze({
    connectionId: String(connection.id),
    workspaceId: String(connection.workspace_id),
  });
}

export function assertCanonicalMessagingWorkspace(
  canonicalWorkspaceId: string,
  persistedWorkspaceId: string,
): string {
  if (canonicalWorkspaceId !== persistedWorkspaceId) {
    throw new Error("messaging_workspace_scope_mismatch");
  }
  return canonicalWorkspaceId;
}

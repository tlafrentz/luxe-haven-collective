import { createClient } from "@/lib/supabase/server";

import {
  OrganizationConcurrencyError,
  type OrganizationAddress,
  type OrganizationProfile,
} from "../domain";
import {
  projectOrganizationProfile,
  type OrganizationActivity,
  type OrganizationRepository,
} from "../application";

type OwnerOrganizationRow = Readonly<{
  id: string;
  profile_id: string;
  company_name: string | null;
  display_name: string | null;
  legal_name: string | null;
  organization_description: string | null;
  website: string | null;
  logo_url: string | null;
  business_email: string | null;
  business_phone: string | null;
  organization_address: OrganizationAddress | null;
  preferred_contact_method: string | null;
  timezone: string | null;
  currency: string | null;
  language: string | null;
  country: string | null;
  organization_confirmed_fields: string[];
  organization_revision: number;
  organization_updated_at: string;
}>;

const organizationColumns = `
  id, profile_id, company_name, display_name, legal_name,
  organization_description, website, logo_url, business_email, business_phone,
  organization_address, preferred_contact_method, timezone, currency, language,
  country, organization_confirmed_fields, organization_revision,
  organization_updated_at
`;

function mapProfile(
  row: OwnerOrganizationRow,
  fallbackName: string,
  authenticatedProfileId: string,
): OrganizationProfile {
  const base = {
    workspaceId: row.id,
    ownerId: row.id,
    profileId: authenticatedProfileId,
    displayName: row.display_name?.trim() || row.company_name?.trim() || fallbackName,
    ...(row.legal_name || row.company_name
      ? { legalName: row.legal_name ?? row.company_name ?? undefined }
      : {}),
    ...(row.organization_description ? { description: row.organization_description } : {}),
    ...(row.website ? { website: row.website } : {}),
    ...(row.logo_url ? { logoUrl: row.logo_url } : {}),
    ...(row.business_email ? { businessEmail: row.business_email } : {}),
    ...(row.business_phone ? { businessPhone: row.business_phone } : {}),
    ...(row.organization_address ? { address: row.organization_address } : {}),
    ...(row.preferred_contact_method
      ? { preferredContactMethod: row.preferred_contact_method }
      : {}),
    timezone: row.timezone ?? "America/Chicago",
    currency: row.currency ?? "USD",
    language: row.language ?? "en-US",
    country: row.country ?? "US",
    confirmedFields: row.organization_confirmed_fields ?? [],
    revision: row.organization_revision ?? 0,
    updatedAt: row.organization_updated_at,
  };
  return projectOrganizationProfile(base);
}

export class SupabaseOrganizationRepository implements OrganizationRepository {
  async get(identity: Parameters<OrganizationRepository["get"]>[0], fallbackName: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("owners")
      .select(organizationColumns)
      .eq("id", identity.ownerId)
      .single();
    if (error) throw new Error(`Unable to load organization: ${error.message}`);
    return mapProfile(
      data as unknown as OwnerOrganizationRow,
      fallbackName,
      identity.profileId,
    );
  }

  async update(input: Parameters<OrganizationRepository["update"]>[0]) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_workspace_organization", {
      p_workspace_id: input.identity.workspaceId,
      p_expected_revision: input.expectedRevision,
      p_command_id: input.idempotencyKey,
      p_payload: input.changes,
    });
    if (error) {
      if (error.code === "40001") throw new OrganizationConcurrencyError();
      throw new Error(`Unable to save organization: ${error.message}`);
    }
    return this.get(input.identity, input.changes.displayName);
  }

  async activity(identity: Parameters<OrganizationRepository["activity"]>[0]) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organization_activity")
      .select("id, actor_profile_id, changed_fields, occurred_at, actor:profiles(full_name)")
      .eq("workspace_id", identity.workspaceId)
      .order("occurred_at", { ascending: false })
      .limit(8);
    if (error) throw new Error(`Unable to load organization activity: ${error.message}`);
    return (data ?? []).map((row): OrganizationActivity => {
      const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
      return {
        id: row.id,
        actorDisplayName: actor?.full_name ?? "Workspace administrator",
        changedFields: row.changed_fields,
        updatedAt: row.occurred_at,
      };
    });
  }
}

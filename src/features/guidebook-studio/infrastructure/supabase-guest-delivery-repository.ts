import type { GuidebookDeliveryRepository } from "../application";
import type { SupabaseClient as Client } from "@supabase/supabase-js";

type SupabaseClient = Pick<Client, "from">;

export class SupabaseGuidebookDeliveryRepository implements GuidebookDeliveryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async resolveActive(slug: string) {
    const { data: guidebook, error } = await this.client.from("guidebooks")
      .select("status,public_url_status,active_version_id")
      .eq("public_slug", slug).maybeSingle();
    if (error || !guidebook) return null;
    if (!guidebook.active_version_id) return { status: String(guidebook.status), publicUrlStatus: String(guidebook.public_url_status), activeVersionId: null, version: null };
    const { data: version, error: versionError } = await this.client.from("guidebook_versions")
      .select("id,version,snapshot,published_at").eq("id", guidebook.active_version_id).eq("status", "published").maybeSingle();
    if (versionError) return null;
    return {
      status: String(guidebook.status), publicUrlStatus: String(guidebook.public_url_status), activeVersionId: String(guidebook.active_version_id),
      version: version ? { id: String(version.id), version: Number(version.version), snapshot: version.snapshot, publishedAt: String(version.published_at) } : null,
    };
  }

  async resolveRedirect(slug: string, now: string) {
    const { data } = await this.client.from("guidebook_public_slug_redirects").select("replacement_slug")
      .eq("prior_slug", slug).gt("expires_at", now).maybeSingle();
    return data ? String(data.replacement_slug) : null;
  }

  async loadHistoricalVersion(input: Readonly<{ actorId: string; workspaceId: string; guidebookId: string; versionId: string }>) {
    const { data: guidebook } = await this.client.from("guidebooks").select("id")
      .eq("id", input.guidebookId).eq("workspace_id", input.workspaceId).maybeSingle();
    if (!guidebook) return null;
    const { data } = await this.client.from("guidebook_versions").select("version,snapshot,published_at")
      .eq("id", input.versionId).eq("guidebook_id", input.guidebookId).maybeSingle();
    return data ? { version: Number(data.version), snapshot: data.snapshot, publishedAt: String(data.published_at) } : null;
  }
}

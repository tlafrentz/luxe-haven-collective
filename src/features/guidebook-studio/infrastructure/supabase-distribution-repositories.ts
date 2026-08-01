import { createAdminClient } from "@/lib/supabase/admin";
import type {
  GuidebookMediaRepository,
  GuidebookSlugRepository,
} from "../application";
type Client = ReturnType<typeof createAdminClient>;

export class SupabaseGuidebookMediaRepository
  implements GuidebookMediaRepository
{
  constructor(private readonly client: Client = createAdminClient()) {}
  async createUpload(
    input: Parameters<GuidebookMediaRepository["createUpload"]>[0],
  ) {
    const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/avif": "avif",
      }[input.mimeType],
      path = `${input.context.workspaceId}/${input.context.guidebookId}/${input.assetId}.${extension}`;
    const { data: guidebook } = await this.client
      .from("guidebooks")
      .select("id")
      .eq("id", input.context.guidebookId)
      .eq("workspace_id", input.context.workspaceId)
      .maybeSingle();
    if (!guidebook) throw new Error("unauthorized");
    const { error: uploadError } = await this.client.storage
      .from("guidebook-authoring-media")
      .upload(path, input.bytes, {
        contentType: input.mimeType,
        upsert: false,
      });
    if (uploadError) throw uploadError;
    const createdAt = new Date().toISOString(),
      { error } = await this.client.from("guidebook_media_assets").insert({
        id: input.assetId,
        workspace_id: input.context.workspaceId,
        guidebook_id: input.context.guidebookId,
        mime_type: input.mimeType,
        byte_size: input.byteSize,
        authoring_path: path,
        upload_state: "ready",
        created_by_profile_id: input.context.actorId,
        created_at: createdAt,
      });
    if (error) {
      await this.client.storage
        .from("guidebook-authoring-media")
        .remove([path]);
      throw error;
    }
    const { error: referenceError } = await this.client
      .from("guidebook_draft_media")
      .insert({
        guidebook_id: input.context.guidebookId,
        media_asset_id: input.assetId,
      });
    if (referenceError) {
      await this.client
        .from("guidebook_media_assets")
        .delete()
        .eq("id", input.assetId);
      await this.client.storage
        .from("guidebook-authoring-media")
        .remove([path]);
      throw referenceError;
    }
    return Object.freeze({
      id: input.assetId,
      workspaceId: input.context.workspaceId,
      guidebookId: input.context.guidebookId,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      authoringPath: path,
      createdAt,
    });
  }
  async promote(input: Parameters<GuidebookMediaRepository["promote"]>[0]) {
    const { data, error } = await this.client
      .from("guidebook_media_assets")
      .select("id,mime_type,authoring_path,public_delivery_path")
      .eq("workspace_id", input.context.workspaceId)
      .eq("guidebook_id", input.context.guidebookId)
      .eq("upload_state", "ready")
      .in("id", [...input.mediaIds]);
    if (error || data?.length !== input.mediaIds.length)
      throw new Error("media_reference_invalid");
    const manifest: Record<string, { url: string; mimeType: string }> = {},
      newlyPromoted: string[] = [];
    try {
      for (const asset of data) {
        let publicPath = asset.public_delivery_path
          ? String(asset.public_delivery_path)
          : "";
        if (!publicPath) {
          const { data: file, error: downloadError } = await this.client.storage
            .from("guidebook-authoring-media")
            .download(String(asset.authoring_path));
          if (downloadError || !file) throw new Error("media_promotion_failed");
          publicPath = `${input.context.guidebookId}/${asset.id}`;
          const { error: uploadError } = await this.client.storage
            .from("guidebook-public-media")
            .upload(publicPath, await file.arrayBuffer(), {
              contentType: String(asset.mime_type),
              upsert: false,
            });
          if (
            uploadError &&
            !uploadError.message.toLowerCase().includes("exist")
          )
            throw uploadError;
          const { error: updateError } = await this.client
            .from("guidebook_media_assets")
            .update({ public_delivery_path: publicPath })
            .eq("id", asset.id)
            .eq("guidebook_id", input.context.guidebookId);
          if (updateError) throw updateError;
          newlyPromoted.push(String(asset.id));
        }
        const { data: url } = this.client.storage
          .from("guidebook-public-media")
          .getPublicUrl(publicPath);
        manifest[String(asset.id)] = {
          url: url.publicUrl,
          mimeType: String(asset.mime_type),
        };
      }
    } catch (original) {
      const cleanup = await this.cleanupPromotion({
        context: input.context,
        mediaIds: newlyPromoted,
      });
      throw Object.assign(
        original instanceof Error
          ? original
          : new Error("media_promotion_failed"),
        { code: "MEDIA_PROMOTION_FAILED", cleanupFailed: cleanup.failed },
      );
    }
    return Object.freeze({
      manifest: Object.freeze(manifest),
      newlyPromoted: Object.freeze(newlyPromoted),
    });
  }
  async cleanupPromotion(
    input: Parameters<GuidebookMediaRepository["cleanupPromotion"]>[0],
  ) {
    const cleaned: string[] = [],
      failed: string[] = [];
    if (!input.mediaIds.length) return { cleaned, failed };
    const { data } = await this.client
      .from("guidebook_media_assets")
      .select("id,public_delivery_path")
      .eq("workspace_id", input.context.workspaceId)
      .eq("guidebook_id", input.context.guidebookId)
      .in("id", [...input.mediaIds]);
    for (const asset of data ?? []) {
      const path = String(asset.public_delivery_path ?? "");
      if (!path) {
        cleaned.push(String(asset.id));
        continue;
      }
      const { error: removeError } = await this.client.storage
        .from("guidebook-public-media")
        .remove([path]);
      if (removeError) {
        failed.push(String(asset.id));
        continue;
      }
      const { error: updateError } = await this.client
        .from("guidebook_media_assets")
        .update({ public_delivery_path: null })
        .eq("id", asset.id)
        .eq("guidebook_id", input.context.guidebookId);
      if (updateError) failed.push(String(asset.id));
      else cleaned.push(String(asset.id));
    }
    return Object.freeze({
      cleaned: Object.freeze(cleaned),
      failed: Object.freeze(failed),
    });
  }
  async garbageCollect(
    input: Parameters<GuidebookMediaRepository["garbageCollect"]>[0],
  ) {
    const cutoff = new Date(
        Date.parse(input.now) - Math.max(24, input.graceHours) * 3_600_000,
      ).toISOString(),
      { data, error } = await this.client
        .from("guidebook_media_assets")
        .select("id,authoring_path,public_delivery_path")
        .lt("created_at", cutoff)
        .not("removed_from_draft_at", "is", null)
        .limit(Math.min(100, input.limit));
    if (error) throw error;
    const deleted: string[] = [],
      refused: string[] = [],
      recoverable: { id: string; code: string }[] = [];
    for (const asset of data ?? []) {
      const [{ count: versionCount }, { count: draftCount }] =
        await Promise.all([
          this.client
            .from("guidebook_version_media")
            .select("media_asset_id", { count: "exact", head: true })
            .eq("media_asset_id", asset.id),
          this.client
            .from("guidebook_draft_media")
            .select("media_asset_id", { count: "exact", head: true })
            .eq("media_asset_id", asset.id),
        ]);
      if ((versionCount ?? 0) > 0 || (draftCount ?? 0) > 0) {
        refused.push(String(asset.id));
        continue;
      }
      const { error: privateDeleteError } = await this.client.storage
        .from("guidebook-authoring-media")
        .remove([String(asset.authoring_path)]);
      if (privateDeleteError) {
        recoverable.push({
          id: String(asset.id),
          code: "STORAGE_DELETE_FAILED",
        });
        continue;
      }
      if (asset.public_delivery_path) {
        const { error: publicDeleteError } = await this.client.storage
          .from("guidebook-public-media")
          .remove([String(asset.public_delivery_path)]);
        if (publicDeleteError) {
          recoverable.push({
            id: String(asset.id),
            code: "STORAGE_DELETE_FAILED",
          });
          continue;
        }
      }
      const { error: deleteError } = await this.client
        .from("guidebook_media_assets")
        .delete()
        .eq("id", asset.id);
      if (deleteError)
        recoverable.push({
          id: String(asset.id),
          code: "DATABASE_DELETE_AFTER_OBJECT_DELETE",
        });
      else deleted.push(String(asset.id));
    }
    return Object.freeze({
      deleted: Object.freeze(deleted),
      refused: Object.freeze(refused),
      recoverable: Object.freeze(recoverable),
    });
  }
}
export class SupabaseGuidebookSlugRepository
  implements GuidebookSlugRepository
{
  constructor(private readonly client: Client = createAdminClient()) {}
  async rotate(input: Parameters<GuidebookSlugRepository["rotate"]>[0]) {
    const { data, error } = await this.client.rpc(
      "rotate_guidebook_public_slug",
      {
        p_guidebook_id: input.context.guidebookId,
        p_workspace_id: input.context.workspaceId,
        p_actor_id: input.context.actorId,
        p_command_id: input.context.commandId,
        p_fingerprint: input.fingerprint,
        p_next_slug: input.nextSlug,
        p_expires_at: input.expiresAt,
      },
    );
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("slug_rotation_failed");
    return {
      slug: String(row.public_slug),
      redirectExpiresAt: String(row.redirect_expires_at),
    };
  }
}

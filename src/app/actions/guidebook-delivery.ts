"use server";
import "server-only";
import { getSessionProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadHistoricalGuidebookPreview, resolvePublicGuidebook, SupabaseGuidebookDeliveryRepository } from "@/features/guidebook-studio";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";

const DEADLINE_MS = 8_000;
export async function getPublicGuidebookDeliveryRequest(slug: string) {
  try { return await deadline(resolvePublicGuidebook(new SupabaseGuidebookDeliveryRepository(createAdminClient()), slug)); }
  catch { return { state: "unavailable" as const }; }
}

export async function getHistoricalGuidebookPreviewRequest(guidebookId: string, versionId: string) {
  try {
    const { user } = await deadline(getSessionProfile());
    if (!user) return { ok: false as const, code: "GUIDEBOOK_UNAUTHORIZED" };
    const access = await deadline(resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id));
    const preview = await deadline(loadHistoricalGuidebookPreview(new SupabaseGuidebookDeliveryRepository(createAdminClient()), { actorId: user.id, workspaceId: access.workspaceId, guidebookId, versionId }));
    return preview ? { ok: true as const, ...preview } : { ok: false as const, code: "VERSION_NOT_FOUND" };
  } catch { return { ok: false as const, code: "WORKSPACE_STATE_UNAVAILABLE" }; }
}

async function deadline<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("deadline")), DEADLINE_MS); })]); }
  finally { if (timer) clearTimeout(timer); }
}

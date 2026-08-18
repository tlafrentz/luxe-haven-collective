"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateWorkspacePermission,
  resolveWorkspaceAccessContext,
  SupabaseTeamAccessRepository,
} from "@/features/workspace";
import { getSessionProfile } from "@/lib/auth/session";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export type GuidebookWorkspaceBrandDefaults = Readonly<{
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  toneOfVoice?: string;
  language: string;
}>;

async function authorized(workspaceId: string, permission: "guidebooks.view" | "guidebooks.manage") {
  const { user } = await getSessionProfile();
  if (!user) throw Object.assign(new Error("unauthorized"), { code: "GUIDEBOOK_UNAUTHORIZED" });
  const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, workspaceId);
  if (!evaluateWorkspacePermission(access, permission)) throw Object.assign(new Error("unauthorized"), { code: "GUIDEBOOK_UNAUTHORIZED" });
  return { user, access };
}

export async function getGuidebookWorkspaceBrandDefaultsAction(
  workspaceId: string,
): Promise<GuidebookWorkspaceBrandDefaults | null> {
  await authorized(workspaceId, "guidebooks.view");
  const db = createAdminClient();
  const { data, error } = await db
    .from("guidebook_workspace_brand_defaults")
    .select("logo_url,primary_color,accent_color,tone_of_voice,language")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data.logo_url ? { logoUrl: String(data.logo_url) } : {}),
    ...(data.primary_color ? { primaryColor: String(data.primary_color) } : {}),
    ...(data.accent_color ? { accentColor: String(data.accent_color) } : {}),
    ...(data.tone_of_voice ? { toneOfVoice: String(data.tone_of_voice) } : {}),
    language: String(data.language ?? "en"),
  };
}

export async function updateGuidebookWorkspaceBrandDefaultsAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  if (!workspaceId) throw Object.assign(new Error("unauthorized"), { code: "GUIDEBOOK_UNAUTHORIZED" });
  const { user } = await authorized(workspaceId, "guidebooks.manage");

  const logoUrlInput = String(formData.get("logoUrl") ?? "").trim();
  const primaryColorInput = String(formData.get("primaryColor") ?? "").trim();
  const accentColorInput = String(formData.get("accentColor") ?? "").trim();
  const toneOfVoiceInput = String(formData.get("toneOfVoice") ?? "").trim().slice(0, 500);
  const languageInput = String(formData.get("language") ?? "en").trim().slice(0, 12) || "en";

  const db = createAdminClient();
  const { error } = await db.from("guidebook_workspace_brand_defaults").upsert(
    {
      workspace_id: workspaceId,
      logo_url: logoUrlInput || null,
      primary_color: HEX_COLOR.test(primaryColorInput) ? primaryColorInput : null,
      accent_color: HEX_COLOR.test(accentColorInput) ? accentColorInput : null,
      tone_of_voice: toneOfVoiceInput || null,
      language: languageInput,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "workspace_id" },
  );
  if (error) throw error;
  revalidatePath("/dashboard/guidebooks/brand");
}

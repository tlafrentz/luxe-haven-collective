"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SupabaseGuidebookDraftRepository,
  sanitizePublicUrl,
  type GuidebookBrandIdentity,
} from "@/features/guidebook-studio";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export async function updateGuidebookBrandAction(formData: FormData) {
  const { user } = await requireRole(["admin"]);
  const guidebookId = String(formData.get("guidebookId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  if (!guidebookId || !workspaceId) return;

  const admin = createAdminClient();
  const drafts = new SupabaseGuidebookDraftRepository(admin);
  const draft = await drafts.load({
    workspaceId,
    guidebookId,
    actorId: user.id,
  });
  if (!draft) return;

  const logoUrlInput = String(formData.get("logoUrl") ?? "").trim();
  const primaryColorInput = String(formData.get("primaryColor") ?? "").trim();
  const accentColorInput = String(formData.get("accentColor") ?? "").trim();
  const logoUrl = sanitizePublicUrl(logoUrlInput, { allowRelative: true });

  const brand: GuidebookBrandIdentity = {
    ...(logoUrlInput ? logoUrl ? { logoUrl } : { logoUrl: draft.brand?.logoUrl } : {}),
    ...(HEX_COLOR.test(primaryColorInput)
      ? { primaryColor: primaryColorInput }
      : draft.brand?.primaryColor
        ? { primaryColor: draft.brand.primaryColor }
        : {}),
    ...(HEX_COLOR.test(accentColorInput)
      ? { accentColor: accentColorInput }
      : draft.brand?.accentColor
        ? { accentColor: draft.brand.accentColor }
        : {}),
  };

  const persistedAt = new Date().toISOString();
  await drafts.save(
    {
      commandId: `admin-brand:${guidebookId}:${Date.now()}`,
      correlationId: crypto.randomUUID(),
      actorId: user.id,
      workspaceId,
      guidebookId,
      expectedRevision: draft.revision,
      enteredAt: persistedAt,
    },
    {
      ...draft,
      brand,
      revision: draft.revision + 1,
      persistedAt,
      persistedBy: user.id,
    },
  );
  revalidatePath(`/admin/guidebooks/${guidebookId}`);
}

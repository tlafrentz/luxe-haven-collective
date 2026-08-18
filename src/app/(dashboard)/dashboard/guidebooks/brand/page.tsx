import { GuidebookPageHeader } from "@/components/guidebooks/guidebook-ui";
import { GuidebookStudioNav, GuidebookAiTrustBanner } from "@/components/guidebooks/guidebook-studio-nav";
import {
  getGuidebookWorkspaceBrandDefaultsAction,
  updateGuidebookWorkspaceBrandDefaultsAction,
} from "@/app/actions/guidebook-brand-defaults";
import { evaluateWorkspacePermission, resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export default async function GuidebookBrandDefaultsPage() {
  const { user } = await requireUser();
  const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
  const canManage = evaluateWorkspacePermission(access, "guidebooks.manage");
  const defaults = await getGuidebookWorkspaceBrandDefaultsAction(access.workspaceId);

  return (
    <main className="mx-auto max-w-3xl space-y-7 py-8">
      <GuidebookStudioNav current="brand" />
      <GuidebookAiTrustBanner />
      <GuidebookPageHeader
        eyebrow="Guidebook Studio"
        title="Brand Kit"
        description="Set default logo, colors, tone of voice, and language for new guidebooks. New guidebooks — including AI-generated drafts — start from these defaults."
      />
      <form
        action={updateGuidebookWorkspaceBrandDefaultsAction}
        className="space-y-5 rounded-3xl border bg-white p-6"
      >
        <input type="hidden" name="workspaceId" value={access.workspaceId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Logo URL
            <input
              name="logoUrl"
              defaultValue={defaults?.logoUrl ?? ""}
              placeholder="https://…"
              disabled={!canManage}
              className="mt-1 block w-full rounded-xl border px-3 py-2 disabled:bg-stone-50"
            />
          </label>
          <label className="text-sm font-medium">
            Language
            <input
              name="language"
              defaultValue={defaults?.language ?? "en"}
              disabled={!canManage}
              className="mt-1 block w-full rounded-xl border px-3 py-2 disabled:bg-stone-50"
            />
          </label>
          <label className="text-sm font-medium">
            Primary color
            <input
              type="color"
              name="primaryColor"
              defaultValue={defaults?.primaryColor ?? "#0c0a09"}
              disabled={!canManage}
              className="mt-1 block h-11 w-full rounded-xl border px-2 disabled:bg-stone-50"
            />
          </label>
          <label className="text-sm font-medium">
            Accent color
            <input
              type="color"
              name="accentColor"
              defaultValue={defaults?.accentColor ?? "#059669"}
              disabled={!canManage}
              className="mt-1 block h-11 w-full rounded-xl border px-2 disabled:bg-stone-50"
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Tone of voice
          <textarea
            name="toneOfVoice"
            defaultValue={defaults?.toneOfVoice ?? ""}
            placeholder="Warm, welcoming, and helpful…"
            disabled={!canManage}
            rows={3}
            className="mt-1 block w-full rounded-xl border px-3 py-2 disabled:bg-stone-50"
          />
        </label>
        {canManage ? (
          <button className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white">
            Save Brand Kit
          </button>
        ) : (
          <p className="text-xs text-stone-500">Your role does not include permission to edit the Brand Kit.</p>
        )}
      </form>
    </main>
  );
}

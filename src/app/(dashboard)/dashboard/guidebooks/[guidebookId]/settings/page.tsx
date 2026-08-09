import { notFound } from "next/navigation";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import {
  archiveGuidebookAction,
  restoreArchivedGuidebookAction,
  rotateGuidebookPublicSlugAction,
} from "@/app/actions/guidebook-authoring";
import { GuidebookNavigation } from "@/components/guidebooks/guidebook-navigation";
import { GuidebookInsufficientPermissions } from "@/components/guidebooks/guidebook-ui";

export default async function GuidebookSettingsPage({
  params,
}: Readonly<{ params: Promise<{ guidebookId: string }> }>) {
  const { guidebookId } = await params,
    result = await getGuidebookEditorRequest(guidebookId);
  if (!result.ok) {
    if (result.code === "guidebook_not_found") notFound();
    return <GuidebookInsufficientPermissions />;
  }
  const archived = result.guidebook.status === "archived",
    revision = Number(result.guidebook.revision),
    workspaceId = String(result.guidebook.workspace_id);
  return (
    <main className="mx-auto max-w-4xl space-y-6 py-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-700">
          Guidebook Studio
        </p>
        <h1 className="mt-2 text-4xl font-semibold">Guidebook settings</h1>
        <p className="mt-2 text-stone-600">{result.guidebook.title}</p>
      </header>
      <GuidebookNavigation guidebookId={guidebookId} current="settings" />
      <section className="rounded-3xl border bg-white p-7">
        <h2 className="font-semibold">Rotate public guest link</h2>
        <p className="mt-2 text-sm text-stone-600">
          Creates a new unguessable public URL. The prior URL redirects for 30
          days without exposing workspace information.
        </p>
        {result.permissions.manage && !archived ? (
          <form
            action={async (formData) => {
              await rotateGuidebookPublicSlugAction(formData);
            }}
            className="mt-5"
          >
            <input type="hidden" name="guidebookId" value={guidebookId} />
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="revision" value={revision} />
            <input type="hidden" name="commandId" value={crypto.randomUUID()} />
            <button className="rounded-full border px-5 py-3 text-sm font-semibold">
              Rotate public link
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-amber-800">
            The public link cannot be rotated in the current state.
          </p>
        )}
      </section>
      <section className="rounded-3xl border bg-white p-7">
        <h2 className="font-semibold">
          {archived ? "Restore guidebook management" : "Archive guidebook"}
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          {archived
            ? "Restoring preserves history and drafts. The guest link stays unavailable until you explicitly publish again."
            : "Archiving immediately disables the guest link while retaining drafts, versions, media references, and analytics."}
        </p>
        {result.permissions.manage ? (
          <form
            action={
              archived ? restoreArchivedGuidebookAction : archiveGuidebookAction
            }
            className="mt-5"
          >
            <input type="hidden" name="guidebookId" value={guidebookId} />
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="revision" value={revision} />
            <button className="rounded-full border border-red-300 px-5 py-3 text-sm font-semibold">
              {archived ? "Restore guidebook" : "Archive guidebook"}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-amber-800">
            Your role cannot change guidebook lifecycle state.
          </p>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import { loadGuidebookAuthoringAction } from "@/app/actions/guidebook-authoring";
import { GuidebookAuthoringWorkspace } from "@/components/guidebooks/guidebook-authoring-workspace";
import { GuidebookPublicationControl } from "@/components/guidebooks/guidebook-publication-control";

export const dynamic = "force-dynamic";

export default async function AdminGuidebookEditorPage({
  params,
}: Readonly<{ params: Promise<{ guidebookId: string }> }>) {
  const { guidebookId } = await params;
  const result = await getGuidebookEditorRequest(guidebookId);
  if (!result.ok) {
    if (result.code === "guidebook_not_found") notFound();
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <section
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-6"
        >
          <h1 className="text-xl font-semibold">Guidebook unavailable</h1>
          <p className="mt-2 text-sm">
            The record is outside the active workspace or your permissions
            changed.
          </p>
        </section>
      </main>
    );
  }
  const canEdit =
    result.permissions.manage && result.guidebook.status !== "archived";
  const authoring = await loadGuidebookAuthoringAction({
    workspaceId: String(result.guidebook.workspace_id),
    guidebookId,
  });
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/guidebooks/list"
            className="text-sm font-semibold text-emerald-800"
          >
            ← All guidebooks
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-emerald-700">
            Guidebook editor · {result.guidebook.status}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {result.guidebook.title}
          </h1>
          <p className="mt-2 text-stone-600">
            {result.property?.name} · Draft revision {result.guidebook.revision}{" "}
            · Published version {result.guidebook.current_version || "none"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/guidebooks/${guidebookId}/preview`}
            className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            Preview
          </Link>
          <Link
            href={`/dashboard/guidebooks/${guidebookId}/versions`}
            className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold"
          >
            History
          </Link>
          {result.guidebook.status === "published" ? (
            <Link
              href={`/g/${result.guidebook.public_slug}`}
              className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Guest portal
            </Link>
          ) : null}
        </div>
      </header>
      <section className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-950">
        <strong>Draft workspace:</strong> edits update the durable working
        draft. Guests continue seeing the immutable published version until
        publication succeeds.
      </section>
      {authoring.ok ? (
        <>
          <GuidebookAuthoringWorkspace
            initialDraft={authoring.draft}
            canEdit={canEdit && authoring.canEdit}
          />
          <GuidebookPublicationControl
            draft={authoring.draft}
            canPublish={
              canEdit &&
              authoring.canEdit &&
              result.entitlements.publish &&
              result.entitlements.host
            }
          />
        </>
      ) : (
        <section
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-6"
        >
          <h2 className="font-semibold">Durable draft unavailable</h2>
          <p className="mt-2 text-sm">
            {authoring.message} Published versions remain unchanged.
          </p>
        </section>
      )}
    </main>
  );
}

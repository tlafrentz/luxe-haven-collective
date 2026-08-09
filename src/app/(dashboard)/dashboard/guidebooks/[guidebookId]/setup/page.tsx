import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import { loadGuidebookAuthoringAction } from "@/app/actions/guidebook-authoring";
import { GuidebookContentSetupWizard } from "@/components/guidebooks/guidebook-content-setup-wizard";

export default async function GuidebookContentSetupPage({
  params,
}: {
  params: Promise<{ guidebookId: string }>;
}) {
  const { guidebookId } = await params;
  const result = await getGuidebookEditorRequest(guidebookId);
  if (!result.ok) {
    if (result.code === "guidebook_not_found") notFound();
    return (
      <main className="mx-auto max-w-3xl py-10">
        <h1 className="text-xl font-semibold">Guidebook unavailable</h1>
        <Link
          href="/dashboard/guidebooks"
          className="mt-4 inline-block underline"
        >
          Return to Guidebooks
        </Link>
      </main>
    );
  }
  const authoring = await loadGuidebookAuthoringAction({
    workspaceId: String(result.guidebook.workspace_id),
    guidebookId,
  });
  if (!authoring.ok)
    return (
      <main className="mx-auto max-w-3xl py-10">
        <h1 className="text-xl font-semibold">Setup unavailable</h1>
        <p className="mt-2">{authoring.message}</p>
      </main>
    );
  return (
    <GuidebookContentSetupWizard
      initialDraft={authoring.draft}
      canEdit={authoring.canEdit && result.guidebook.status !== "archived"}
    />
  );
}

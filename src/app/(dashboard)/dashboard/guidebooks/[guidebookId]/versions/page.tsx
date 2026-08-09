import { notFound } from "next/navigation";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import { GuidebookNavigation } from "@/components/guidebooks/guidebook-navigation";
import { GuidebookVersionHistory } from "@/components/guidebooks/guidebook-version-history";
import { GuidebookInsufficientPermissions } from "@/components/guidebooks/guidebook-ui";

export default async function GuidebookVersionsPage({ params }: Readonly<{ params: Promise<{ guidebookId: string }> }>) {
  const { guidebookId } = await params;
  const result = await getGuidebookEditorRequest(guidebookId);
  if (!result.ok) {
    if (result.code === "guidebook_not_found") notFound();
    return <GuidebookInsufficientPermissions />;
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 py-8">
      <header><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-700">Guidebook Studio</p><h1 className="mt-2 text-4xl font-semibold">Version history</h1><p className="mt-2 text-stone-600">{result.guidebook.title} · Immutable publication history</p></header>
      <GuidebookNavigation guidebookId={guidebookId} current="versions" />
      <GuidebookVersionHistory guidebookId={guidebookId} workspaceId={String(result.guidebook.workspace_id)} revision={Number(result.guidebook.revision)} versions={result.historyVersions} timeline={result.timeline} deliveries={result.deliveries} canRestore={result.permissions.manage&&result.guidebook.status!=="archived"}/>
    </main>
  );
}

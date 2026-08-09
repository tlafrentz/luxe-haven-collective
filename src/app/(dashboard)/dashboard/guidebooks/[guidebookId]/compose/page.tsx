import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import { loadGuidebookAuthoringAction } from "@/app/actions/guidebook-authoring";
import { GuidebookBuilderWorkspace } from "@/components/guidebooks/guidebook-builder-workspace";
import { propertyProjectionVariables } from "@/features/property-projection";

export default async function GuidebookComposePage({
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
        <h1 className="text-xl font-semibold">Builder unavailable</h1>
        <p className="mt-2">{authoring.message}</p>
      </main>
    );
  const variables = propertyProjectionVariables(
    result.propertyProjection,
    `/stay/${result.guidebook.public_slug}`,
  );
  return (
    <GuidebookBuilderWorkspace
      initialDraft={authoring.draft}
      versionId={String(result.guidebook.active_draft_version_id ?? "Draft")}
      canEdit={authoring.canEdit && result.guidebook.status !== "archived"}
      canPublish={false}
      previewVariables={{
        "property.name": variables.propertyName,
        "property.address": variables.address,
        "stay.check_in_time": variables.checkInTime,
        "stay.check_out_time": variables.checkOutTime,
        "host.name": variables.hostName,
        "host.phone": variables.hostPhone,
      }}
    />
  );
}

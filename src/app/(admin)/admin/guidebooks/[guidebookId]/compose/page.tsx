import { notFound } from "next/navigation";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import { loadGuidebookAuthoringAction } from "@/app/actions/guidebook-authoring";
import { GuidebookBuilderWorkspace } from "@/components/guidebooks/guidebook-builder-workspace";
import { propertyProjectionVariables } from "@/features/property-projection";

export const dynamic = "force-dynamic";
export default async function AdminGuidebookComposePage({
  params,
}: {
  params: Promise<{ guidebookId: string }>;
}) {
  const { guidebookId } = await params,
    result = await getGuidebookEditorRequest(guidebookId);
  if (!result.ok) {
    if (result.code === "guidebook_not_found") notFound();
    return (
      <main className="p-10">
        <p role="alert">
          Guidebook unavailable in the selected customer workspace.
        </p>
      </main>
    );
  }
  const authoring = await loadGuidebookAuthoringAction({
    workspaceId: String(result.guidebook.workspace_id),
    guidebookId,
  });
  if (!authoring.ok)
    return (
      <main className="p-10">
        <p role="alert">{authoring.message}</p>
      </main>
    );
  const canEdit =
    result.permissions.manage &&
    result.guidebook.status !== "archived" &&
    authoring.canEdit;
  const variables = propertyProjectionVariables(
    result.propertyProjection,
    `/stay/${result.guidebook.public_slug}`,
  );
  return (
    <GuidebookBuilderWorkspace
      initialDraft={authoring.draft}
      versionId={String(result.guidebook.revision)}
      canEdit={canEdit}
      canPublish={false}
      basePath="/admin/guidebooks"
      propertyName={variables.propertyName}
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

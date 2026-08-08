import { notFound } from "next/navigation";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import { loadGuidebookAuthoringAction } from "@/app/actions/guidebook-authoring";
import { buildDraftArtifactPayload } from "@/app/actions/guidebook-draft-artifact";
import { getApprovalReviewAction } from "@/app/actions/guidebook-approval-review";
import { GuidebookPublishWorkspace } from "@/components/guidebooks/guidebook-publish-workspace";
import {
  compareGuidebookVersions,
  type GuidebookVersionRecord,
} from "@/features/guidebook-studio";

export default async function Page({
  params,
}: {
  params: Promise<{ guidebookId: string }>;
}) {
  const { guidebookId } = await params;
  const result = await getGuidebookEditorRequest(guidebookId);
  if (!result.ok) notFound();
  const authoring = await loadGuidebookAuthoringAction({
    workspaceId: String(result.guidebook.workspace_id),
    guidebookId,
  });
  if (!authoring.ok) notFound();

  const publishedVersion = result.historyVersions.find(
    (version: GuidebookVersionRecord) => version.status === "published",
  );
  const [draftArtifact, approvalReview] = await Promise.all([
    buildDraftArtifactPayload(guidebookId, result),
    getApprovalReviewAction(guidebookId),
  ]);
  const changesSincePublished = publishedVersion
    ? compareGuidebookVersions(publishedVersion, {
        id: "draft",
        version: draftArtifact.version,
        status: "draft",
        snapshot: draftArtifact.payload,
        publishedAt: draftArtifact.publishedAt,
        artifactVersion: draftArtifact.artifactVersion,
        rendererVersion: draftArtifact.rendererVersion,
      })
    : null;

  return (
    <GuidebookPublishWorkspace
      draft={authoring.draft}
      propertyName={result.property?.name ?? "Property"}
      publicSlug={String(result.guidebook.public_slug)}
      status={String(result.guidebook.status)}
      canPublish={
        authoring.canEdit && result.entitlements.publish && result.entitlements.host
      }
      basePath="/dashboard/guidebooks"
      currentPublishedVersion={publishedVersion?.version ?? null}
      changesSincePublished={changesSincePublished}
      approvalRequest={approvalReview.request}
      authoringMode={String(result.guidebook.authoring_mode ?? "self")}
    />
  );
}

"use server";
import "server-only";
import { listGuidebookDraftMediaAction } from "@/app/actions/guidebook-authoring";
import type { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import type { GuidebookArtifactPayload } from "@/features/guidebook-studio";
import { propertyProjectionSnapshot } from "@/features/property-projection";
import type { PublishedArtifactEnvelope } from "@/platform/artifact-rendering";

type EditorResult = Awaited<ReturnType<typeof getGuidebookEditorRequest>> & {
  ok: true;
};

/**
 * Builds an artifact envelope for the current durable draft in the same
 * shape a published version snapshot would take, so the draft can be run
 * through the real guest renderer (DB-08 preview) or diffed against the
 * currently published version (AD-11 "changes since published") using the
 * same domain functions that operate on real published snapshots.
 */
export async function buildDraftArtifactPayload(
  guidebookId: string,
  result: EditorResult,
): Promise<PublishedArtifactEnvelope<GuidebookArtifactPayload>> {
  const media = await listGuidebookDraftMediaAction({
    workspaceId: String(result.guidebook.workspace_id),
    guidebookId,
  });
  const mediaMap = Object.fromEntries(
    media.map((item) => [item.id, { url: item.url, mimeType: item.mimeType }]),
  );
  const featuredImage =
    result.propertyProjection.guest.featuredImage.state === "available"
      ? result.propertyProjection.guest.featuredImage.value
      : undefined;
  return {
    artifactType: "guidebook",
    artifactVersion: "guidebook-draft-preview.v1",
    rendererVersion: "guidebook-web-renderer.v1",
    publishedAt: result.draft?.persistedAt ?? new Date().toISOString(),
    version: result.draft?.revision ?? result.guidebook.revision,
    payload: {
      title: result.draft?.title ?? result.guidebook.title,
      description: result.draft?.description ?? result.guidebook.description,
      brand: { ...(result.draft?.brand ?? {}) },
      property: {
        name: result.propertyProjection.identity.name,
        ...(featuredImage ? { featuredImage } : {}),
      },
      propertyProjection: propertyProjectionSnapshot(result.propertyProjection),
      sections: result.draftSections,
      recommendations: result.recommendations,
      media: mediaMap,
    },
  };
}

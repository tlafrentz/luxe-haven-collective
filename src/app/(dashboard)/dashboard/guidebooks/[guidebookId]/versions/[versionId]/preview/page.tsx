import Link from "next/link";
import { notFound } from "next/navigation";
import { getHistoricalGuidebookPreviewRequest } from "@/app/actions/guidebook-delivery";
import { PublicGuidebookExperience } from "@/components/guidebooks/public-guidebook-experience";
import { GuidebookInsufficientPermissions } from "@/components/guidebooks/guidebook-ui";
import {
  ArtifactRenderingEngine,
  type PublishedArtifactEnvelope,
} from "@/platform/artifact-rendering";
import {
  guidebookPublicRenderer,
  type GuidebookArtifactPayload,
  type PublicGuidebookView,
} from "@/features/guidebook-studio";

export const dynamic = "force-dynamic";
export default async function HistoricalGuidebookPreviewPage({
  params,
}: Readonly<{
  params: Promise<{ guidebookId: string; versionId: string }>;
}>) {
  const { guidebookId, versionId } = await params;
  const result = await getHistoricalGuidebookPreviewRequest(
    guidebookId,
    versionId,
  );
  if (!result.ok) {
    if (result.code === "GUIDEBOOK_UNAUTHORIZED")
      return <GuidebookInsufficientPermissions />;
    notFound();
  }
  let guidebook: PublicGuidebookView;
  try {
    guidebook = new ArtifactRenderingEngine()
      .register(guidebookPublicRenderer)
      .render<
        GuidebookArtifactPayload,
        PublicGuidebookView
      >(result.envelope as PublishedArtifactEnvelope<GuidebookArtifactPayload>);
  } catch {
    notFound();
  }
  return (
    <div>
      <div
        role="status"
        className="sticky top-0 z-[90] flex flex-wrap items-center justify-between gap-3 bg-amber-100 px-5 py-3 text-sm text-amber-950"
      >
        <strong>
          Historical preview · Version {guidebook.meta.guidebookVersion}
        </strong>
        <span>
          This immutable version is not the live guest guide and cannot be
          edited here.
        </span>
        <Link
          className="font-semibold underline"
          href={`/dashboard/guidebooks/${guidebookId}/versions`}
        >
          Return to versions
        </Link>
      </div>
      <PublicGuidebookExperience
        slug="historical-preview"
        guidebook={guidebook}
        source="link"
        trackEvents={false}
      />
    </div>
  );
}

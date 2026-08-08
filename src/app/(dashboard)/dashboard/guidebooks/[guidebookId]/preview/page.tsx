import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import { getHistoricalGuidebookPreviewRequest } from "@/app/actions/guidebook-delivery";
import { listGuidebookDraftMediaAction } from "@/app/actions/guidebook-authoring";
import { PublicGuidebookExperience } from "@/components/guidebooks/public-guidebook-experience";
import {
  ArtifactRenderingEngine,
  type PublishedArtifactEnvelope,
} from "@/platform/artifact-rendering";
import {
  guidebookPublicRenderer,
  type GuidebookArtifactPayload,
  type PublicGuidebookView,
} from "@/features/guidebook-studio";
import { propertyProjectionSnapshot } from "@/features/property-projection";

export const dynamic = "force-dynamic";

const viewportWidths: Record<string, number> = {
  mobile: 390,
  tablet: 834,
  desktop: 1280,
};

type EditorResult = Awaited<ReturnType<typeof getGuidebookEditorRequest>> & {
  ok: true;
};

async function buildDraftGuidebookView(
  guidebookId: string,
  result: EditorResult,
): Promise<PublicGuidebookView> {
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
  const artifact: PublishedArtifactEnvelope<GuidebookArtifactPayload> = {
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
  return guidebookPublicRenderer.render(artifact);
}

async function buildPublishedGuidebookView(
  guidebookId: string,
  result: EditorResult,
): Promise<PublicGuidebookView | null> {
  if (!result.guidebook.published_version) return null;
  const publishedRow = result.versions.find(
    (row: { version: number }) =>
      Number(row.version) === Number(result.guidebook.published_version),
  ) as { id: string } | undefined;
  if (!publishedRow) return null;
  const historical = await getHistoricalGuidebookPreviewRequest(
    guidebookId,
    String(publishedRow.id),
  );
  if (!historical.ok) return null;
  try {
    return new ArtifactRenderingEngine()
      .register(guidebookPublicRenderer)
      .render<GuidebookArtifactPayload, PublicGuidebookView>(
        historical.envelope as PublishedArtifactEnvelope<GuidebookArtifactPayload>,
      );
  } catch {
    return null;
  }
}

export default async function GuidebookPreview({
  params,
  searchParams,
}: {
  params: Promise<{ guidebookId: string }>;
  searchParams: Promise<{ viewport?: string; mode?: string; embed?: string }>;
}) {
  const { guidebookId } = await params;
  const query = await searchParams;
  const viewport = (
    ["desktop", "tablet", "mobile"].includes(query.viewport ?? "")
      ? query.viewport!
      : "mobile"
  ) as "desktop" | "tablet" | "mobile";
  const requestedMode = query.mode === "published" ? "published" : "draft";
  const embed = query.embed === "1";

  const result = await getGuidebookEditorRequest(guidebookId);
  if (!result.ok) notFound();

  const publishedAvailable = Boolean(result.guidebook.published_version);
  const mode =
    requestedMode === "published" && !publishedAvailable
      ? "draft"
      : requestedMode;

  const guidebookView =
    mode === "published"
      ? await buildPublishedGuidebookView(guidebookId, result)
      : await buildDraftGuidebookView(guidebookId, result);
  if (!guidebookView) notFound();

  if (embed) {
    return (
      <PublicGuidebookExperience
        slug={`preview-${guidebookId}`}
        guidebook={guidebookView}
        source="link"
        trackEvents={false}
      />
    );
  }

  const linkQuery = (nextViewport: string, nextMode: string) =>
    `?viewport=${nextViewport}&mode=${nextMode}`;
  const frameQuery = (nextViewport: string, nextMode: string) =>
    `?viewport=${nextViewport}&mode=${nextMode}&embed=1`;

  return (
    <main className="min-h-screen bg-[#eee5d7] px-4 py-8">
      <div className="mx-auto mb-5 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/dashboard/guidebooks/${guidebookId}`}
            className="text-sm font-semibold text-stone-800"
          >
            ← Return to Studio
          </Link>
          <div className="flex flex-wrap gap-2">
            <a
              href="/contact"
              className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold"
            >
              Report a problem
            </a>
            <Link
              href={`/dashboard/guidebooks/${guidebookId}/publish`}
              className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Looks Good, Continue →
            </Link>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-stone-600">
              {mode === "draft" ? "Draft preview" : "Published preview"} ·{" "}
              {viewport}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {mode === "draft"
                ? `Draft revision ${result.draft?.revision ?? result.guidebook.revision} · Updated ${new Date(result.draft?.persistedAt ?? result.propertyProjection.updatedAt).toLocaleString()}`
                : `Published version ${result.guidebook.published_version}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav
              aria-label="Preview version"
              className="flex rounded-full border bg-white p-1"
            >
              <Link
                href={linkQuery(viewport, "draft")}
                aria-current={mode === "draft" ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === "draft" ? "bg-stone-950 text-white" : ""}`}
              >
                Draft
              </Link>
              <Link
                href={linkQuery(viewport, "published")}
                aria-current={mode === "published" ? "page" : undefined}
                aria-disabled={!publishedAvailable}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === "published" ? "bg-stone-950 text-white" : ""} ${!publishedAvailable ? "pointer-events-none opacity-40" : ""}`}
              >
                Published
              </Link>
            </nav>
            <nav
              aria-label="Preview viewport"
              className="flex rounded-full border bg-white p-1"
            >
              {["desktop", "tablet", "mobile"].map((item) => (
                <Link
                  key={item}
                  href={linkQuery(item, mode)}
                  aria-current={viewport === item ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${viewport === item ? "bg-stone-950 text-white" : ""}`}
                >
                  {item}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        {mode === "draft" && result.propertyDrift.reviewRecommended ? (
          <p
            role="status"
            className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-950"
          >
            {result.propertyDrift.summary} This preview uses current property
            values; the published guidebook remains unchanged.
          </p>
        ) : null}
      </div>
      <div className="mx-auto flex justify-center">
        <iframe
          title="Guidebook preview"
          src={frameQuery(viewport, mode)}
          style={{
            width: viewportWidths[viewport],
            maxWidth: "100%",
            height: "80vh",
            border: 0,
            borderRadius: "1.5rem",
            boxShadow: "0 24px 80px rgba(50,40,25,.25)",
            background: "#fbf8f1",
          }}
        />
      </div>
    </main>
  );
}

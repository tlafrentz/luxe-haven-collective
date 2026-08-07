import Link from "next/link";
import { notFound } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import { loadGuidebookAuthoringAction } from "@/app/actions/guidebook-authoring";
import { GuidebookNavigation } from "@/components/guidebooks/guidebook-navigation";
import { GuidebookPublicationControl } from "@/components/guidebooks/guidebook-publication-control";

export default async function GuidebookImprovePage({
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
  if (!authoring.ok)
    return (
      <main className="mx-auto max-w-3xl py-10">
        <h1 className="text-xl font-semibold">Recommendations unavailable</h1>
      </main>
    );

  const draft = authoring.draft;
  const components = draft.sections
    .flatMap((section) => section.blocks)
    .filter((block) => block.type === "component");
  const usedKeys = new Set(components.map((block) => block.content.componentKey));
  const wifiBlock = components.find((block) => block.content.componentKey === "wifi_card");
  const wifiThin = wifiBlock ? (wifiBlock.content.fields.body ?? "").trim().length < 40 : true;

  const recommendations = [
    !usedKeys.has("parking_card")
      ? {
          title: "Guests often search for parking info.",
          body: "Consider adding more details.",
          action: "Improve Parking",
        }
      : null,
    wifiThin
      ? {
          title: "Your WiFi section could be more helpful.",
          body: "Add troubleshooting tips.",
          action: "Update WiFi",
        }
      : null,
    !usedKeys.has("recommendation_collection") && !usedKeys.has("recommendation_card")
      ? {
          title: "Add more local neighborhood guides.",
          body: "Guests love neighborhood guides.",
          action: "Add Recommendations",
        }
      : null,
  ].filter((item): item is { title: string; body: string; action: string } => item !== null);

  return (
    <main className="mx-auto max-w-4xl space-y-6 py-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-700">
          Guidebook Studio
        </p>
        <h1 className="mt-2 text-4xl font-semibold">Keep Improving</h1>
        <p className="mt-2 text-stone-600">
          Recommendations to enhance your guest experience.
        </p>
      </header>
      <GuidebookNavigation guidebookId={guidebookId} current="improve" />
      <section className="rounded-3xl border bg-white p-6">
        {recommendations.length ? (
          <ul className="space-y-3">
            {recommendations.map((item) => (
              <li
                key={item.action}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-4"
              >
                <div className="flex items-start gap-3">
                  <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-sm text-stone-600">{item.body}</p>
                  </div>
                </div>
                <Link
                  href={`/dashboard/guidebooks/${guidebookId}/edit`}
                  className="rounded-full bg-stone-950 px-4 py-2 text-xs font-semibold text-white"
                >
                  {item.action}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-600">
            No recommendations right now — your guidebook covers the essentials well.
          </p>
        )}
      </section>
      <GuidebookPublicationControl
        draft={draft}
        canPublish={authoring.canEdit}
        publicSlug={result.guidebook.public_slug}
        basePath="/dashboard/guidebooks"
        label="Publish Version 2"
      />
    </main>
  );
}

import { GuidebookPageHeader } from "@/components/guidebooks/guidebook-ui";
import { GuidebookStudioNav, GuidebookAiTrustBanner } from "@/components/guidebooks/guidebook-studio-nav";
import { getPublishedGuidebookTemplates } from "@/app/actions/guidebook-templates";

export default async function GuidebookTemplatesPage() {
  const templates = await getPublishedGuidebookTemplates();
  return (
    <main className="mx-auto max-w-7xl space-y-7 py-8">
      <GuidebookStudioNav current="templates" />
      <GuidebookAiTrustBanner />
      <GuidebookPageHeader
        eyebrow="Guidebook Studio"
        title="Templates"
        description="Browse published templates for inspiration when starting a new guidebook."
      />
      {templates.length ? (
        <section aria-label="Published templates" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <article key={template.id} className="rounded-2xl border bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{template.category}</p>
              <h2 className="mt-2 font-semibold">{template.name}</h2>
              <p className="mt-2 text-sm text-stone-600">{template.description}</p>
              {template.tags.length ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {template.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <p className="rounded-2xl border bg-white p-6 text-sm text-stone-500">No published templates are available yet.</p>
      )}
    </main>
  );
}

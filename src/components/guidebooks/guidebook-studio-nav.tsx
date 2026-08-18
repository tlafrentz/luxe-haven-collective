import Link from "next/link";

const items = [
  ["Guidebooks", "/dashboard/guidebooks"],
  ["Templates", "/dashboard/guidebooks/templates"],
  ["Brand Kit", "/dashboard/guidebooks/brand"],
] as const;

/** Service-level local navigation for Guidebook Studio — sits inside the shared Dashboard shell, not a second sidebar. */
export function GuidebookStudioNav({ current }: Readonly<{ current: "guidebooks" | "templates" | "brand" }>) {
  return (
    <nav aria-label="Guidebook Studio" className="overflow-x-auto rounded-2xl border bg-white p-2">
      <ul className="flex min-w-max gap-1">
        {items.map(([label, href]) => {
          const key = label.toLowerCase().startsWith("brand") ? "brand" : (label.toLowerCase() as "guidebooks" | "templates");
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={current === key ? "page" : undefined}
                className={`block rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-amber-600 ${
                  current === key ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Persistent trust-principle banner: AI drafts, humans review, nothing auto-publishes. */
export function GuidebookAiTrustBanner() {
  return (
    <section role="note" aria-label="AI content policy" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950">
      <p className="font-semibold">AI creates a draft. Humans review. Nothing auto-publishes.</p>
      <p className="mt-1 text-emerald-900">
        Every AI-generated guidebook section stays a draft until a person on your team confirms it and explicitly submits it for review.
      </p>
    </section>
  );
}

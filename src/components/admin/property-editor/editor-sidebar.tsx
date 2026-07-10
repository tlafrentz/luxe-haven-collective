import Link from "next/link";

const sections = [
  "Overview",
  "Location",
  "Photos",
  "Pricing",
  "Amenities",
  "Rules",
  "SEO",
  "Publishing",
];

export function EditorSidebar() {
  return (
    <aside className="h-fit rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 lg:sticky lg:top-8">
      <p className="px-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/35">
        Editor
      </p>

      <nav className="mt-4 grid gap-1">
        {sections.map((section) => (
          <Link
            key={section}
            href={`#${section.toLowerCase()}`}
            className="rounded-2xl px-3 py-3 text-sm text-white/60 hover:bg-white/10 hover:text-white"
          >
            {section}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

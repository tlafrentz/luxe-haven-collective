import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Template Previews",
  description: "Professional templates designed for every style.",
};

const styles = ["All", "Luxury", "Beach", "Modern", "Cabin", "Family"] as const;

const templates = [
  { name: "Luxe Haven", style: "Luxury", gradient: "from-[#0b2b24] via-[#c78a38] to-[#f4ead7]" },
  { name: "Coastal Escape", style: "Beach", gradient: "from-[#0e5f6b] via-[#8fd3d8] to-[#fdf6e9]" },
  { name: "Modern Minimal", style: "Modern", gradient: "from-[#1a1a1a] via-[#6b6b6b] to-[#e8e8e8]" },
  { name: "Mountain Retreat", style: "Cabin", gradient: "from-[#3d2b1f] via-[#8a6d4d] to-[#e6d6bd]" },
  { name: "Family Gathering", style: "Family", gradient: "from-[#7a3b2e] via-[#d99a5b] to-[#fbeadb]" },
];

export default async function GuidebookTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>;
}) {
  const { style } = await searchParams;
  const activeStyle = style && styles.includes(style as (typeof styles)[number]) ? style : styles[0];
  const visibleTemplates = templates.filter(
    (template) => activeStyle === "All" || template.style === activeStyle,
  );

  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/guidebook-studio">Guidebook Studio</Link>
            <span className="mx-2">›</span>
            <span>Templates</span>
          </nav>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl md:text-6xl">
            Professional templates designed for every style.
          </h1>
          <div className="mt-7 flex flex-wrap gap-2">
            {styles.map((item) => {
              const isActive = item === activeStyle;
              const href = item === "All" ? "/guidebook-studio/templates" : `/guidebook-studio/templates?style=${item}`;
              return (
                <Link
                  key={item}
                  href={href}
                  aria-current={isActive ? "true" : undefined}
                  className={
                    isActive
                      ? "rounded-md bg-emerald-950 px-4 py-2 text-xs text-white"
                      : "rounded-md border bg-white px-4 py-2 text-xs text-stone-600 hover:border-stone-400"
                  }
                >
                  {item}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTemplates.map((template) => (
            <article key={template.name} className="overflow-hidden rounded-xl border bg-white">
              <div className={`aspect-[4/3] bg-gradient-to-br ${template.gradient}`} />
              <div className="p-4">
                <h2 className="font-serif text-xl">{template.name}</h2>
                <p className="mt-1 text-xs uppercase tracking-wide text-stone-500">{template.style}</p>
              </div>
            </article>
          ))}
          <Link
            href="/guidebook-studio/packages"
            className="flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center"
          >
            <span className="font-serif text-xl">View All Templates</span>
            <span className="mt-2 text-xs text-stone-500">Choose your template after purchase</span>
          </Link>
        </div>
      </section>
    </main>
  );
}

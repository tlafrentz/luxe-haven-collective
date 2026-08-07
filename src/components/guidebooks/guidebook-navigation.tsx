import Link from "next/link";

const items = [
  ["Content", ""],
  ["Preview", "/preview"],
  ["Versions", "/versions"],
  ["Share", "/share"],
  ["Analytics", "/analytics"],
  ["Improve", "/improve"],
  ["Settings", "/settings"],
] as const;

export function GuidebookNavigation({ guidebookId, current }: Readonly<{ guidebookId: string; current: string }>) {
  return (
    <nav aria-label="Guidebook workspace" className="overflow-x-auto rounded-2xl border bg-white p-2">
      <ul className="flex min-w-max gap-1">
        {items.map(([label, suffix]) => (
          <li key={label}>
            <Link
              href={`/dashboard/guidebooks/${guidebookId}${suffix}`}
              aria-current={current === label.toLowerCase() ? "page" : undefined}
              className={`block rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-amber-600 ${
                current === label.toLowerCase() ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

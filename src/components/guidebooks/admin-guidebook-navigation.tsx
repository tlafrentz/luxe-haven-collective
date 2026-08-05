import Link from "next/link";

const items = [
  ["Overview", "/admin/guidebooks"],
  ["Guidebooks", "/admin/guidebooks/list"],
  ["Content Library", "/admin/guidebooks/content"],
  ["Experience Components", "/admin/guidebooks/components"],
  ["Templates", "/admin/guidebooks/templates"],
  ["Media Library", "/admin/guidebooks/media"],
  ["Analytics", "/admin/guidebooks/analytics"],
  ["Settings", "/admin/guidebooks/settings"],
] as const;

export function AdminGuidebookNavigation({
  current,
}: Readonly<{ current: string }>) {
  return (
    <nav
      aria-label="Guidebook Studio"
      className="overflow-x-auto border-b border-stone-200"
    >
      <ul className="flex min-w-max gap-7">
        {items.map(([label, href]) => {
          const active = current === label.toLowerCase().replaceAll(" ", "-");
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block border-b-2 px-0.5 py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${active ? "border-emerald-600 text-stone-950" : "border-transparent text-stone-600 hover:text-stone-950"}`}
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

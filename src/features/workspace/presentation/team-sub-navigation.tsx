import Link from "next/link";

const TABS = [
  { id: "people", label: "People", href: "/dashboard/workspace/team" },
  { id: "roles", label: "Roles", href: "/dashboard/workspace/team/roles" },
] as const;

export function TeamSubNavigation({ active }: Readonly<{ active: "people" | "roles" }>) {
  return (
    <nav aria-label="Team & Access sections" className="mb-6">
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={tab.id === active ? "page" : undefined}
            className={[
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
              tab.id === active ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

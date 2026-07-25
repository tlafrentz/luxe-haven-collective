"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getWorkspaceNavigation } from "../application";

export function WorkspaceLocalNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace sections" className="border-b border-stone-200">
      <div className="flex gap-1 overflow-x-auto py-2">
        {getWorkspaceNavigation().map((item) => {
          const active =
            item.href === "/dashboard/workspace"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                active
                  ? "bg-stone-950 text-white"
                  : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

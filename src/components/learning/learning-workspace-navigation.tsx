"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Outcomes", href: "/dashboard/learn", matches: ["/dashboard/learn", "/dashboard/learn/outcomes"] },
  { label: "Experiments", href: "/dashboard/learn/experiments", matches: ["/dashboard/learn/experiments"] },
  { label: "Knowledge", href: "/dashboard/learn/lessons", matches: ["/dashboard/learn/lessons"] },
  { label: "Improvement", href: "/dashboard/learn/improvement", matches: ["/dashboard/learn/improvement"] },
] as const;

export function LearningWorkspaceNavigation() {
  const pathname = usePathname();

  return <nav aria-label="Learn workspace" className="mt-6 flex gap-2 overflow-x-auto pb-1 text-sm">
    {items.map(item => {
      const active = item.href === "/dashboard/learn"
        ? pathname === "/dashboard/learn" || pathname === "/dashboard/learn/outcomes" || pathname.startsWith("/dashboard/learn/outcomes/")
        : item.matches.some(match => pathname === match || pathname.startsWith(`${match}/`));
      return <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`shrink-0 rounded-full border px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${active ? "border-teal-800 bg-teal-800 text-white" : "border-stone-300 bg-white text-stone-800 hover:border-teal-700"}`}
      >
        {item.label}
      </Link>;
    })}
  </nav>;
}

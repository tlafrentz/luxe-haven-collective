"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Boxes,
  ChartNoAxesColumn,
  FileText,
  House,
  Image,
  LayoutTemplate,
  Settings,
} from "lucide-react";

const items = [
  ["Overview", "/admin/guidebooks", House],
  ["Guidebooks", "/admin/guidebooks/list", BookOpen],
  ["Content Library", "/admin/guidebooks/content", FileText],
  ["Experience Components", "/admin/guidebooks/components", Boxes],
  ["Templates", "/admin/guidebooks/templates", LayoutTemplate],
  ["Media Library", "/admin/guidebooks/media", Image],
  ["Analytics", "/admin/guidebooks/analytics", ChartNoAxesColumn],
  ["Settings", "/admin/guidebooks/settings", Settings],
] as const;

export function AdminGuidebookNavigation({
  current,
}: Readonly<{ current?: string }>) {
  const pathname = usePathname();
  return (
    <nav aria-label="Guidebook Studio" className="p-3">
      <ul className="space-y-1">
        {items.map(([label, href, Icon]) => {
          const key = label.toLowerCase().replaceAll(" ", "-");
          const active = current
            ? current === key
            : href === "/admin/guidebooks"
              ? pathname === href
              : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${active ? "bg-emerald-50 text-emerald-900" : "text-stone-700 hover:bg-stone-50 hover:text-stone-950"}`}
              >
                <Icon
                  aria-hidden="true"
                  className="size-5 shrink-0"
                  strokeWidth={1.7}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

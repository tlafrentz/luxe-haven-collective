"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceNavigation } from "@/components/application-layout";

const destinations = [
  { label: "Overview", href: "/dashboard/investments" },
  { label: "Analyze", href: "/dashboard/investments/new" },
  { label: "Scenarios", href: "/dashboard/investments/scenarios" },
  { label: "Opportunities", href: "/dashboard/investments/opportunities" },
  { label: "Reports", href: "/dashboard/investments/reports" },
  { label: "Settings", href: "/dashboard/investments/settings" },
] as const;

export function InvestmentWorkspaceShellNavigation() {
  const pathname = usePathname();
  const active = pathname.startsWith("/dashboard/investments/new")
    ? "/dashboard/investments/new"
    : pathname.startsWith("/dashboard/investments/scenarios")
    ? "/dashboard/investments/scenarios"
    : pathname.includes("/opportunities") || pathname.includes("/portfolio")
      ? "/dashboard/investments/opportunities"
      : pathname.startsWith("/dashboard/investments/reports")
        ? "/dashboard/investments/reports"
        : pathname.startsWith("/dashboard/investments/settings")
          ? "/dashboard/investments/settings"
          : "/dashboard/investments";
  return <WorkspaceNavigation label="Investment Intelligence workspace" items={destinations} activeHref={active} action={<Link href="/dashboard/investments/new" className="inline-flex min-h-10 items-center rounded-lg bg-stone-950 px-4 text-sm font-semibold text-white">+ New Analysis</Link>} />;
}

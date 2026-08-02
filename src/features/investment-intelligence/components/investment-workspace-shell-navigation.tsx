"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceNavigation } from "@/components/application-layout";

const destinations = [
  { label: "Analyze", href: "/dashboard/investments" },
  { label: "Scenarios", href: "/dashboard/investments/scenarios" },
  { label: "Opportunities", href: "/dashboard/investments/opportunities" },
] as const;

export function InvestmentWorkspaceShellNavigation() {
  const pathname = usePathname();
  const active = pathname.startsWith("/dashboard/investments/scenarios")
    ? "/dashboard/investments/scenarios"
    : pathname.includes("/opportunities") || pathname.includes("/portfolio")
      ? "/dashboard/investments/opportunities"
      : "/dashboard/investments";
  return <WorkspaceNavigation label="Investment Intelligence workspace" items={destinations} activeHref={active} action={<Link href="/dashboard/investments/new" className="inline-flex min-h-10 items-center rounded-lg bg-stone-950 px-4 text-sm font-semibold text-white">+ New Analysis</Link>} />;
}

"use client";

import { usePathname } from "next/navigation";
import { WorkspaceNavigation } from "@/components/application-layout";

const destinations = [
  { label: "Overview", href: "/dashboard/investments" },
  { label: "Analyze", href: "/dashboard/investments/new" },
  { label: "Scenarios", href: "/dashboard/investments/scenarios" },
  { label: "Opportunities", href: "/dashboard/investments/opportunities" },
] as const;

export function InvestmentWorkspaceShellNavigation() {
  const pathname = usePathname();
  const active = pathname.startsWith("/dashboard/investments/new")
    ? "/dashboard/investments/new"
    : pathname.startsWith("/dashboard/investments/scenarios")
    ? "/dashboard/investments/scenarios"
    : pathname.includes("/opportunities") || pathname.includes("/portfolio")
      ? "/dashboard/investments/opportunities"
      : "/dashboard/investments";
  return <WorkspaceNavigation label="Investment Intelligence workspace" items={destinations} activeHref={active} />;
}

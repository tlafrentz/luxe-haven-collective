import { WorkspaceLocalNavigation } from "@/components/intelligence-workspace-navigation";
const items = [
  { label: "Overview", href: "/dashboard/understand/portfolio", exact: true },
  { label: "Properties", href: "/dashboard/understand/portfolio/properties" },
  { label: "Concentration", href: "/dashboard/understand/portfolio/concentration" },
] as const;
export default function PortfolioLensLayout({ children }: { children: React.ReactNode }) { return <><WorkspaceLocalNavigation label="Portfolio Intelligence views" items={items} />{children}</>; }

import { WorkspaceLocalNavigation } from "@/components/intelligence-workspace-navigation";
import { FinancialShellActions } from "@/features/financial-intelligence/presentation/financial-shell-actions";
const items = [
  { label: "Overview", href: "/dashboard/observe/financial", exact: true },
  { label: "Expenses", href: "/dashboard/observe/financial/expenses" },
  { label: "Cash Flow", href: "/dashboard/observe/financial/cash-flow" },
  { label: "Forecast", href: "/dashboard/observe/financial/forecast" },
] as const;
export default function FinancialLensLayout({ children }: { children: React.ReactNode }) { return <><FinancialShellActions/><WorkspaceLocalNavigation label="Financial Intelligence views" items={items} />{children}</>; }

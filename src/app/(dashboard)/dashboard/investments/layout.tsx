import type { ReactNode } from "react";
import { InvestmentWorkspaceShellNavigation } from "@/features/investment-intelligence/components/investment-workspace-shell-navigation";

export default function InvestmentIntelligenceLayout({ children }: { children: ReactNode }) {
  return <><InvestmentWorkspaceShellNavigation />{children}</>;
}

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isAutomationWorkspaceEnabled } from "@/features/automation-workspace";
export default function AutomationLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isAutomationWorkspaceEnabled()) notFound();
  return children;
}

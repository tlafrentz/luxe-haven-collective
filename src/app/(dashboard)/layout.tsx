import type { ReactNode } from "react"

import { ClientWorkspaceShell } from "@/components/platform-shell"
import { requireUser } from "@/lib/auth/session"

type DashboardLayoutProps = {
  children: ReactNode
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const { profile } = await requireUser()

  // ClientWorkspaceShell replaces the legacy DashboardShell while preserving the route-group contract.
  return <ClientWorkspaceShell role={profile?.role}>{children}</ClientWorkspaceShell>
}

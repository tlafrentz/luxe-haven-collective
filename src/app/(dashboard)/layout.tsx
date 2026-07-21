import type { ReactNode } from "react"

import { DashboardShell } from "@/components/portal/dashboard-shell"
import { requireUser } from "@/lib/auth/session"

type DashboardLayoutProps = {
  children: ReactNode
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  await requireUser()

  return <DashboardShell>{children}</DashboardShell>
}

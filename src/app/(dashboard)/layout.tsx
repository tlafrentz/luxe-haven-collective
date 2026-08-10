import type { ReactNode } from "react"

import { AppShell } from "@/components/application-layout"
import { SupabaseTeamAccessRepository } from "@/features/workspace"
import { requireUser } from "@/lib/auth/session"

type DashboardLayoutProps = {
  children: ReactNode
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const { user, profile } = await requireUser()
  const access = await new SupabaseTeamAccessRepository().resolve(user.id)

  const enabledFeatureFlags = process.env.HPM_UNIFIED_WORKSPACE_ENABLED === "false" ? [] : ["hpm-unified-workspace"]
  return <AppShell role={access?.role ?? profile?.role} enabledFeatureFlags={enabledFeatureFlags}>{children}</AppShell>
}

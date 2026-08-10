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

  const hpmInternalEligible = process.env.HPM_COHORT_ENABLED === "true" && (process.env.HPM_ROLLOUT_COHORT ?? "verification") === "internal" && profile?.role === "admin"
  const enabledFeatureFlags = process.env.HPM_UNIFIED_WORKSPACE_ENABLED === "true" && process.env.HPM_WORKSPACE_KILL_SWITCH !== "true" && hpmInternalEligible ? ["hpm-unified-workspace"] : []
  return <AppShell role={access?.role ?? profile?.role} enabledFeatureFlags={enabledFeatureFlags}>{children}</AppShell>
}

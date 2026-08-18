import type { ReactNode } from "react"

import { AppShell } from "@/components/application-layout"
import { getCommerceAccessWorkspace } from "@/app/actions/commerce-access"
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

  const commerceAccess = await getCommerceAccessWorkspace({ workspaceId: access?.workspaceId })
  const entitlements = (commerceAccess?.entitlements ?? [])
    .filter((entitlement) => entitlement.status === "available")
    .map((entitlement) => entitlement.key)

  return (
    <AppShell role={access?.role ?? profile?.role} entitlements={entitlements}>
      {children}
    </AppShell>
  )
}

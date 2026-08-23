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

  if (!access) {
    return (
      <AppShell role={profile?.role} entitlements={[]}>
        <main className="mx-auto max-w-3xl px-5 py-16">
          <section role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Workspace access unavailable</p>
            <h1 className="mt-3 text-3xl font-semibold text-stone-950">You no longer have access to this workspace</h1>
            <p className="mt-3 text-stone-700">Your workspace membership is inactive or has been removed. Contact a workspace administrator if you believe this is incorrect.</p>
          </section>
        </main>
      </AppShell>
    )
  }

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

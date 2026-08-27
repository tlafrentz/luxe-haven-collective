import type { ReactNode } from "react";

import { AppShell } from "@/components/application-layout";
import { getCommerceAccessWorkspace } from "@/app/actions/commerce-access";
import { SupabaseTeamAccessRepository } from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { InitializeWorkspaceForm } from "@/features/workspace/presentation/initialize-workspace-form";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const { user, profile } = await requireUser();
  const access = await new SupabaseTeamAccessRepository().resolve(user.id);

  if (!access) {
    const client = await createClient();
    const { data: pendingInvitation } = await client.rpc(
      "has_pending_workspace_invitation" as never,
    );
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-5 py-16">
        <section
          role="alert"
          className="rounded-3xl border border-amber-200 bg-amber-50 p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Workspace access unavailable
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-stone-950">
            {pendingInvitation
              ? "Finish accepting your invitation"
              : "You no longer have access to this workspace"}
          </h1>
          <p className="mt-3 text-stone-700">
            {pendingInvitation
              ? "Your account is authenticated, but workspace access is not active yet. Return to the invitation link and complete the explicit acceptance step."
              : "Your workspace membership is inactive or has been removed. Contact a workspace administrator if you believe this is incorrect."}
          </p>
          {!pendingInvitation &&
          (profile?.role === "owner" || profile?.role === "admin") ? (
            <div className="mt-6 rounded-2xl bg-stone-950 p-5 text-white">
              <p className="text-sm text-stone-300">
                If this is a new account, initialize its first workspace through
                the canonical owner setup boundary.
              </p>
              <InitializeWorkspaceForm />
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  const commerceAccess = await getCommerceAccessWorkspace({
    workspaceId: access?.workspaceId,
  });
  const entitlements = (commerceAccess?.entitlements ?? [])
    .filter((entitlement) => entitlement.status === "available")
    .map((entitlement) => entitlement.key);

  return (
    <AppShell role={access?.role ?? profile?.role} entitlements={entitlements}>
      {children}
    </AppShell>
  );
}

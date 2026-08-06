import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { loadSetupContext } from "@/features/workspace-setup/application/load-setup-context";
import { SetupShellHeader } from "@/features/workspace-setup/presentation/setup-shell";

export default async function WorkspaceSetupLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireUser();
  const { progress } = await loadSetupContext(user.id, profile?.full_name ?? null);

  return (
    <div className="min-h-screen bg-stone-50">
      <SetupShellHeader progress={progress} />
      <main>{children}</main>
    </div>
  );
}

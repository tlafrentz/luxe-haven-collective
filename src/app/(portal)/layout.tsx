import { ClientWorkspaceShell } from "@/components/platform-shell";
import { requireUser } from "@/lib/auth/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  return <ClientWorkspaceShell role={profile?.role}>{children}</ClientWorkspaceShell>;
}

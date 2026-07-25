import { AppShell } from "@/components/application-layout";
import { requireUser } from "@/lib/auth/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  return <AppShell role={profile?.role}>{children}</AppShell>;
}

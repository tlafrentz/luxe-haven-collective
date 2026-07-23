import { OperationsConsoleShell } from "@/components/platform-shell";
import { requireRole } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireRole(["admin"]);
  return <OperationsConsoleShell role={profile?.role}>{children}</OperationsConsoleShell>;
}

import { HpmDashboard } from "@/components/hpm-dashboard";
import { filterOperationalProjection, getOperationalSurfaceProjection } from "@/features/operational-surfaces";
import { requireUser } from "@/lib/auth/session";

type HomePageProps = Readonly<{ searchParams: Promise<{ property?: string; start?: string; end?: string; from?: string; to?: string }> }>;

export default async function HomePage({ searchParams }: HomePageProps) {
  const [{ user, profile }, params] = await Promise.all([requireUser(), searchParams]);
  const full = await getOperationalSurfaceProjection({
    principal: { userId: user.id, workspaceId: user.id, role: profile?.role ?? "guest" },
    workspaceLabel: profile?.full_name ? `${profile.full_name}'s Workspace` : "Luxe Haven Workspace",
  });
  // Keep Home synchronized with the canonical shared Workspace Context. The
  // visual dashboard consumes this projection as its live-data boundary.
  filterOperationalProjection(full, {
    propertyId: params.property,
    startDate: params.from??params.start,
    endDate: params.to??params.end,
  });
  return <HpmDashboard screen="home" />;
}

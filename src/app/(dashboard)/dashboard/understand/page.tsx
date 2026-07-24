import { OperationalQualityIndicator } from "@/components/product/operational";
import { resolveAnalyticsDateRange } from "@/features/analytics";
import {
  ExecutiveCommandCenter,
  getExecutiveIntelligenceView,
} from "@/features/executive-intelligence";
import { getOperationalSurfaceProjection } from "@/features/operational-surfaces";
import { requireUser } from "@/lib/auth/session";

type ExecutivePageProps = Readonly<{
  searchParams: Promise<{
    property?: string;
    start?: string;
    end?: string;
  }>;
}>;

export default async function ExecutivePage({
  searchParams,
}: ExecutivePageProps) {
  const params = await searchParams;
  const { user, profile } = await requireUser();
  const dateRange = resolveAnalyticsDateRange({
    startDate: params.start,
    endDate: params.end,
  });
  const [result, operations] = await Promise.all([
    getExecutiveIntelligenceView({
      propertyId: params.property ?? null,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
    getOperationalSurfaceProjection({
      principal: {
        userId: user.id,
        workspaceId: user.id,
        role: profile?.role ?? "guest",
      },
      workspaceLabel: profile?.full_name
        ? `${profile.full_name}'s Workspace`
        : "Luxe Haven Workspace",
    }),
  ]);

  return (
    <div>
      <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            Operational evidence
          </p>
          <p className="mt-1 text-sm text-stone-700">
            Business interpretation uses the same owner-scoped booking,
            property, synchronization, and quality context as Home.
          </p>
        </div>
        <OperationalQualityIndicator status={operations.quality.status} />
      </section>
      <ExecutiveCommandCenter view={result.view} />
    </div>
  );
}

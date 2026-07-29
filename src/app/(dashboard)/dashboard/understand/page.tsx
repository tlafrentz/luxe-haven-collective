import { OperationalQualityIndicator } from "@/components/product/operational";
import { addDays, resolveAnalyticsDateRange } from "@/features/analytics";
import {
  ExecutiveCommandCenter,
  buildExecutiveBusinessHealth,
  financialOverviewExecutivePillar,
  SupabaseExecutiveHealthProjectionWriter,
  getExecutiveIntelligenceView,
} from "@/features/executive-intelligence";
import { getOperationalSurfaceProjection } from "@/features/operational-surfaces";
import { requireUser } from "@/lib/auth/session";
import { getFinancialOverviewRouteState } from "@/app/actions/financial-overview-runtime";
import Link from "next/link";

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
  const [result, operations, financial] = await Promise.all([
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
    getFinancialOverviewRouteState({periodPreset:"custom",comparisonType:"previous-period",customFrom:dateRange.startDate,customTo:addDays(dateRange.endDate,-1)}),
  ]);
  const existingPillars=Object.values(result.view.businessHealth.pillars).filter(pillar=>pillar.score!==null).map(pillar=>({
    pillar:pillar.pillar,score:pillar.score,confidence:pillar.confidence,evidence:pillar.evidence,limitations:pillar.limitations,risks:pillar.risks,opportunities:pillar.opportunities,
  }));
  const businessHealth=buildExecutiveBusinessHealth({workspaceId:financial.ok?financial.overview.identity.workspaceId:result.view.businessHealth.workspaceId,period:result.view.businessHealth.period,
    generatedAt:result.view.businessHealth.generatedAt,pillars:[...existingPillars.filter(pillar=>pillar.pillar!=="financial"),...(financial.ok?[financialOverviewExecutivePillar(financial.overview)]:[])]});
  const executiveView={...result.view,businessHealth,health:{...result.view.health,score:businessHealth.score,confidence:businessHealth.confidence.score,status:businessHealth.status,
    summary:businessHealth.score===null?"Business health is unavailable because canonical pillar evidence is incomplete.":`${businessHealth.confidence.availablePillars} of seven pillars support the current executive health assessment.`,
    availablePillars:businessHealth.confidence.availablePillars,totalPillars:7,supportingScoreKeys:Object.values(businessHealth.pillars).filter(pillar=>pillar.score!==null).map(pillar=>pillar.pillar)}};
  let projectionPersistenceWarning:string|null=null;
  if(financial.ok)try{await new SupabaseExecutiveHealthProjectionWriter().put(businessHealth,user.id)}
  catch(error){const correlationId=crypto.randomUUID();projectionPersistenceWarning=`Executive history could not be updated. Correlation: ${correlationId}`;
    console.error("capability_operation_failed",{correlationId,capability:"executive-intelligence",operation:"persist-business-health",code:"EXECUTIVE_HEALTH_PERSISTENCE_FAILED",workspaceId:businessHealth.workspaceId,retryable:true,timestamp:new Date().toISOString(),errorType:error instanceof Error?error.name:"unknown"});}

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
      {projectionPersistenceWarning?<p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{projectionPersistenceWarning}</p>:null}
      {financial.ok?<section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Canonical financial health</p><p className="mt-1 text-sm text-stone-700">Executive Intelligence is reading the same evidence-backed Financial projection as the Financial workspace.</p></div><Link href="/dashboard/financial" className="rounded-full border px-4 py-2 text-sm font-semibold">Open financial evidence →</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-4">{["revenue","operating-expenses","noi","operating-margin"].map(key=>{const metric=financial.overview.metrics.find(item=>item.metric===key);return<div className="rounded-xl bg-stone-50 p-4" key={key}><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{key.replaceAll("-"," ")}</p><p className="mt-2 text-lg font-semibold">{metric?.current.money?metric.current.money.format():metric?.current.percentage!==undefined?`${(metric.current.percentage*100).toFixed(1)}%`:"Unavailable"}</p><p className="mt-1 text-xs capitalize text-stone-500">{metric?.current.qualification??"unavailable"} · {financial.overview.confidence} confidence</p></div>})}</div></section>:null}
      <ExecutiveCommandCenter view={executiveView} />
    </div>
  );
}

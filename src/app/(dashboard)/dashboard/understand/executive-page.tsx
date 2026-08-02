import { addDays, resolveAnalyticsDateRange } from "@/features/analytics";
import { buildExecutiveBusinessHealth, ExecutiveWorkspace, financialOverviewExecutivePillar, type ExecutiveFinancialMetric, type ExecutiveTab, getExecutiveIntelligenceView, SupabaseExecutiveHealthProjectionWriter } from "@/features/executive-intelligence";
import { getFinancialOverviewRouteState } from "@/app/actions/financial-overview-runtime";
import { requireUser } from "@/lib/auth/session";

export type ExecutiveSearchParams=Promise<{property?:string;start?:string;end?:string}>;

export async function ExecutivePageView({searchParams,tab}:Readonly<{searchParams:ExecutiveSearchParams;tab:ExecutiveTab}>) {
  const params=await searchParams;
  const {user}=await requireUser();
  const range=resolveAnalyticsDateRange({startDate:params.start,endDate:params.end});
  const [result,financial]=await Promise.all([
    getExecutiveIntelligenceView({propertyId:params.property??null,startDate:range.startDate,endDate:range.endDate}),
    getFinancialOverviewRouteState({periodPreset:"custom",comparisonType:"previous-period",customFrom:range.startDate,customTo:addDays(range.endDate,-1)}),
  ]);
  const metrics:ExecutiveFinancialMetric[]=financial?.ok?financial.overview.metrics.filter(metric=>["revenue","operating-expenses","noi","operating-margin","cash-balance"].includes(metric.metric)).map(metric=>({
    label:metric.metric.replaceAll("-"," ").replace(/\b\w/g,letter=>letter.toUpperCase()),
    value:metric.current.money?metric.current.money.format():metric.current.percentage!==undefined?`${(metric.current.percentage*100).toFixed(1)}%`:"Unavailable",
    comparison:metric.current.percentage!==undefined&&metric.comparison?.percentage!==undefined?`${metric.current.percentage>=metric.comparison.percentage?"↑":"↓"} ${Math.abs((metric.current.percentage-metric.comparison.percentage)*100).toFixed(1)} pp`:metric.change?.percentageChange!==undefined?`${metric.change.percentageChange>=0?"↑":"↓"} ${Math.abs(metric.change.percentageChange*100).toFixed(1)}%`:"No comparison available",
    confidence:`${metric.current.qualification.replaceAll("-"," ")} · ${financial.overview.confidence} confidence`,
  })):[];
  const existing=Object.values(result.view.businessHealth.pillars).filter(pillar=>pillar.score!==null).map(pillar=>({pillar:pillar.pillar,score:pillar.score,confidence:pillar.confidence,evidence:pillar.evidence,limitations:pillar.limitations,risks:pillar.risks,opportunities:pillar.opportunities}));
  const health=financial?.ok?buildExecutiveBusinessHealth({workspaceId:financial.overview.identity.workspaceId,period:result.view.businessHealth.period,generatedAt:result.view.businessHealth.generatedAt,pillars:[...existing.filter(pillar=>pillar.pillar!=="financial"),financialOverviewExecutivePillar(financial.overview)]}):result.view.businessHealth;
  const view={...result.view,businessHealth:health,health:{...result.view.health,score:health.score,confidence:health.confidence.score,status:health.status,availablePillars:health.confidence.availablePillars,supportingScoreKeys:Object.values(health.pillars).filter(pillar=>pillar.score!==null).map(pillar=>pillar.pillar)}};
  if(tab==="overview"&&financial?.ok)try{await new SupabaseExecutiveHealthProjectionWriter().put(health,user.id)}catch(error){console.error("capability_operation_failed",{correlationId:crypto.randomUUID(),capability:"executive-intelligence",operation:"persist-business-health",code:"EXECUTIVE_HEALTH_PERSISTENCE_FAILED",workspaceId:health.workspaceId,retryable:true,timestamp:new Date().toISOString(),errorType:error instanceof Error?error.name:"unknown"})}
  return <ExecutiveWorkspace view={view} tab={tab} financial={metrics}/>;
}

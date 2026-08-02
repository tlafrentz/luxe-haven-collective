import { getFinancialOverviewRouteState, type FinancialComparisonType, type FinancialPeriodPreset } from "@/app/actions/financial-overview-runtime";
import { getFinancialExpenseWorkspaceRouteState } from "@/app/actions/financial-expense-workspace-runtime";
import { FinancialOverviewErrorView, FinancialOverviewView } from "@/features/financial-intelligence/presentation";

export default async function FinancialOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const scope = single(params.scope);
  const propertyIds = scope === "workspace" || !params.properties ? undefined : values(params.properties);
  const result = await getFinancialOverviewRouteState({
    workspaceId: single(params.workspace), propertyIds,
    periodPreset: single(params.from) && single(params.to) ? "custom" : preset(single(params.period)), comparisonType: comparison(single(params.comparison)),
    customFrom: single(params.from), customTo: single(params.to),
  });
  if(!result.ok)return <FinancialOverviewErrorView code={result.code} message={result.message}/>;
  const expenseResult=await getFinancialExpenseWorkspaceRouteState({workspaceId:result.overview.identity.workspaceId,propertyIds:result.overview.scope.propertyIds,from:result.overview.period.from,to:result.overview.period.to,basis:"actual"});
  const expenseView=view(single(params.expenseView));
  return <FinancialOverviewView overview={result.overview} expenses={expenseResult.ok?expenseResult.workspace.expenses:[]} properties={expenseResult.ok?expenseResult.workspace.properties:[]} expenseView={expenseView}/>;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function values(value: string | string[]) { return Array.isArray(value) ? value : [value]; }
function preset(value?: string): FinancialPeriodPreset { return ["this-month", "last-month", "qtd", "ytd", "12m", "custom"].includes(value ?? "") ? value as FinancialPeriodPreset : "last-month"; }
function comparison(value?: string): FinancialComparisonType { return ["previous-period", "previous-year", "budget", "forecast", "none"].includes(value ?? "") ? value as FinancialComparisonType : "previous-period"; }
function view(value?:string){return (["list","category","recurring"].includes(value??"")?value:"list") as "list"|"category"|"recurring";}

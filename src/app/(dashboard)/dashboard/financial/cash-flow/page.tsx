import { getCashFlowLiquidityRouteState } from "@/app/actions/cash-flow-liquidity-runtime";
import type { FinancialPeriodPreset } from "@/app/actions/financial-overview-runtime";
import { CashFlowErrorView, CashFlowLiquidityPage } from "@/features/financial-intelligence/presentation";

export default async function CashFlowPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams, scope = single(params.scope);
  const result = await getCashFlowLiquidityRouteState({
    workspaceId: single(params.workspace), propertyIds: scope === "workspace" || !params.properties ? undefined : values(params.properties),
    accountIds: params.accounts ? values(params.accounts) : undefined, periodPreset: preset(single(params.period)),
    comparisonType: comparison(single(params.comparison)), obligationHorizonDays: horizon(single(params.horizon)),
    customFrom: single(params.from), customTo: single(params.to),
  });
  return result.ok ? <CashFlowLiquidityPage view={result.view} /> : <CashFlowErrorView code={result.code} message={result.message} />;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function values(value: string | string[]) { return Array.isArray(value) ? value : [value]; }
function preset(value?: string): FinancialPeriodPreset { return ["this-month","last-month","qtd","ytd","12m","custom"].includes(value ?? "") ? value as FinancialPeriodPreset : "this-month"; }
function comparison(value?: string) { return ["previous-year","forecast","none"].includes(value ?? "") ? value as "previous-year"|"forecast"|"none" : "previous-period"; }
function horizon(value?: string): 7|30|60|90 { const parsed=Number(value); return parsed===7||parsed===60||parsed===90?parsed:30; }

import { evaluatePropertyAccess, evaluateWorkspacePermission, type WorkspaceAccessContext } from "@/features/workspace";
import {
  buildFinancialReadModel, CashFlowLiquidityError, type BuildCashFlowLiquidityInput,
  type CashAccountBalance, type CashFlowLiquidityReader, type CashMovement, type CashObligation,
  type FinancialSource, type GetCashFlowLiquidityQuery, type ReservePolicy, type ScheduledCash,
} from "../application";
import type { FinancialPropertyCatalog } from "./financial-overview-projection-adapter";

export interface CashAccountBalanceReader {
  read(input: Readonly<{ workspaceId: string; propertyIds: readonly string[]; requestedAccountIds?: readonly string[]; period: GetCashFlowLiquidityQuery["period"] }>): Promise<readonly CashAccountBalance[]>;
}
export interface CashTransactionReader {
  read(input: Readonly<{ workspaceId: string; propertyIds: readonly string[]; accountIds: readonly string[]; period: GetCashFlowLiquidityQuery["period"] }>): Promise<readonly CashMovement[]>;
}
export interface CashObligationSource {
  read(input: Readonly<{ workspaceId: string; propertyIds: readonly string[]; horizonDays: 7|30|60|90; evaluatedAt: string }>): Promise<Readonly<{ sourceAvailable: boolean; coverage: number; items: readonly CashObligation[] }>>;
}
export interface ReservePolicyReader { read(workspaceId: string, propertyIds: readonly string[]): Promise<readonly ReservePolicy[]>; }
export interface CashForecastSummaryReader { read(workspaceId: string, propertyIds: readonly string[], period: GetCashFlowLiquidityQuery["period"]): Promise<ScheduledCash | null>; }

const emptyBalances: CashAccountBalanceReader = { read: async () => [] };
const emptyMovements: CashTransactionReader = { read: async () => [] };

export class CashFlowLiquidityProjectionAdapter implements CashFlowLiquidityReader {
  constructor(
    private readonly access: WorkspaceAccessContext,
    private readonly financialSource: FinancialSource,
    private readonly propertyCatalog: FinancialPropertyCatalog,
    private readonly dependencies: Readonly<{
      balances?: CashAccountBalanceReader; movements?: CashTransactionReader;
      obligations?: CashObligationSource; reserves?: ReservePolicyReader; forecast?: CashForecastSummaryReader;
    }> = {},
  ) {}

  async read(query:GetCashFlowLiquidityQuery):Promise<BuildCashFlowLiquidityInput>{
    if(query.workspaceId!==this.access.workspaceId||!evaluateWorkspacePermission(this.access,"financial.cash.summary.view"))throw new CashFlowLiquidityError("permission","Cash Flow access is not permitted.");
    const catalog=await this.propertyCatalog.list(query.workspaceId),eligible=catalog.filter(item=>item.included&&item.reportingEligible&&evaluatePropertyAccess(this.access,item.propertyId)),requested=query.propertyIds?[...new Set(query.propertyIds)]:undefined;
    if(requested?.some(id=>!eligible.some(item=>item.propertyId===id)))throw new CashFlowLiquidityError("permission","A selected property is outside the authorized cash scope.");
    const properties=eligible.filter(item=>!requested||requested.includes(item.propertyId)),propertyIds=properties.map(item=>item.propertyId).sort(),evaluatedAt=query.evaluatedAt??new Date().toISOString();
    const financial=await buildFinancialReadModel(this.financialSource,{access:this.access,workspaceId:query.workspaceId,propertyIds,period:query.period,evaluatedAt,authorizationLevel:"read"});
    const balanceReader=this.dependencies.balances??emptyBalances,movementReader=this.dependencies.movements??emptyMovements;
    const accounts=await balanceReader.read({workspaceId:query.workspaceId,propertyIds,requestedAccountIds:query.accountIds,period:query.period});
    if(accounts.some(item=>item.workspaceId!==query.workspaceId||(item.propertyId&&!propertyIds.includes(item.propertyId))))throw new CashFlowLiquidityError("account_scope","A cash account was returned outside the authorized scope.");
    if(query.accountIds?.some(id=>!accounts.some(account=>account.id===id)))throw new CashFlowLiquidityError("account_scope","A selected cash account is outside the authorized scope.");
    const accountIds=accounts.map(item=>item.id),movements=await movementReader.read({workspaceId:query.workspaceId,propertyIds,accountIds,period:query.period});
    if(movements.some(item=>item.workspaceId!==query.workspaceId||!accountIds.includes(item.accountId)||(item.propertyId&&!propertyIds.includes(item.propertyId))))throw new CashFlowLiquidityError("account_scope","Cash movement was returned outside the authorized scope.");
    let comparisonAccounts:readonly CashAccountBalance[]|undefined,comparisonMovements:readonly CashMovement[]|undefined;
    if((query.comparisonType==="previous-period"||query.comparisonType==="previous-year")&&query.period.comparison){
      const comparisonPeriod={...query.period,from:query.period.comparison.from,to:query.period.comparison.to,comparison:undefined};
      comparisonAccounts=await balanceReader.read({workspaceId:query.workspaceId,propertyIds,requestedAccountIds:query.accountIds,period:comparisonPeriod});
      comparisonMovements=await movementReader.read({workspaceId:query.workspaceId,propertyIds,accountIds:comparisonAccounts.map(item=>item.id),period:comparisonPeriod});
    }
    const canViewAccounts=evaluateWorkspacePermission(this.access,"financial.cash.accounts.view"),canViewTransactions=evaluateWorkspacePermission(this.access,"financial.cash.transactions.view"),canViewObligations=evaluateWorkspacePermission(this.access,"financial.cash.obligations.view"),canViewReserves=evaluateWorkspacePermission(this.access,"financial.cash.reserves.view"),horizon=query.obligationHorizonDays??30;
    const [obligations,reservePolicies,scheduledCash]=await Promise.all([
      canViewObligations?this.dependencies.obligations?.read({workspaceId:query.workspaceId,propertyIds,horizonDays:horizon,evaluatedAt}).catch(()=>({sourceAvailable:false,coverage:0,items:[]})):undefined,
      canViewReserves?this.dependencies.reserves?.read(query.workspaceId,propertyIds).catch(()=>[]):undefined,
      query.comparisonType==="forecast"?this.dependencies.forecast?.read(query.workspaceId,propertyIds,query.period).catch(()=>null):undefined,
    ]);
    const scope=Object.freeze({type:query.accountIds?.length?"selected-properties"as const:query.portfolioId?"portfolio"as const:propertyIds.length===1?"single-property"as const:requested?"selected-properties"as const:"workspace"as const,label:query.accountIds?.length?"Selected Accounts":query.portfolioId?"Authorized Portfolio":propertyIds.length===1?properties[0]?.label??"Single Property":requested?"Selected Properties":this.access.propertyAccess.type==="all"?"Full Workspace":"Authorized Properties",propertyIds:Object.freeze(propertyIds),propertyCount:propertyIds.length});
    return Object.freeze({financial,scope,accounts:Object.freeze(accounts),movements:Object.freeze(movements),...(comparisonAccounts?{comparisonAccounts:Object.freeze(comparisonAccounts)}:{}),...(comparisonMovements?{comparisonMovements:Object.freeze(comparisonMovements)}:{}),propertyLabels:Object.freeze(Object.fromEntries(properties.map(item=>[item.propertyId,item.label]))),obligations:obligations??{sourceAvailable:false,coverage:0,items:[]},reservePolicies:Object.freeze(reservePolicies??[]),...(scheduledCash?{scheduledCash}:{}),historyMonths:financial.evidence.historyMonths,...(query.comparisonType!=="none"?{comparisonType:query.comparisonType}:{}),obligationHorizonDays:horizon,canViewAccounts,canViewTransactions,canViewObligations,canViewReserves,permissionLimited:this.access.propertyAccess.type!=="all"||!canViewAccounts||!canViewTransactions,evaluatedAt,projectionVersion:`cash-flow-v1:${financial.evaluatedAt}`});
  }
}

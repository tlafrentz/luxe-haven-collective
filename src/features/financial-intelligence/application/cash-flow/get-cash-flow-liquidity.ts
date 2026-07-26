import { buildCashFlowLiquidityView } from "./build-cash-flow-liquidity";
import type { BuildCashFlowLiquidityInput, CashFlowLiquidityCache, CashFlowLiquidityReader, CashFlowLiquidityView, GetCashFlowLiquidityQuery } from "./contracts";

export class CashFlowLiquidityError extends Error {
  constructor(readonly code:"permission"|"configuration"|"currency"|"account_scope"|"reconciliation"|"transfer_matching"|"data_quality"|"obligation_coverage"|"unavailable"|"conflict"|"unexpected",message:string){super(message);this.name="CashFlowLiquidityError";}
}
export function cashFlowLiquidityCacheKey(input:BuildCashFlowLiquidityInput){
  const accounts=[...input.accounts.map(item=>item.id)].sort().join(","),permissions=`${input.canViewAccounts?"accounts":"no-accounts"}:${input.canViewTransactions?"transactions":"no-transactions"}:${input.canViewObligations?"obligations":"no-obligations"}:${input.canViewReserves?"reserves":"no-reserves"}`;
  return["cash-flow",input.financial.identity.workspaceId,input.scope.type,[...input.scope.propertyIds].sort().join(","),accounts,permissions,input.financial.period.from,input.financial.period.to,input.comparisonType??"none",input.financial.identity.reportingCurrency,CASH_VERSIONS,input.obligations.items.map(item=>item.id).sort().join(","),input.reservePolicies.map(item=>item.id).sort().join(","),input.projectionVersion??"v1"].join("|");
}
const CASH_VERSIONS="cash-v1:transfer-v1:obligation-v1:reserve-v1";
export async function getCashFlowLiquidity(reader:CashFlowLiquidityReader,query:GetCashFlowLiquidityQuery,cache?:CashFlowLiquidityCache):Promise<CashFlowLiquidityView>{
  let input:BuildCashFlowLiquidityInput;try{input=await reader.read(query);}catch(error){if(error instanceof CashFlowLiquidityError)throw error;const message=error instanceof Error?error.message:"";if(message.includes("CURRENCY"))throw new CashFlowLiquidityError("currency","Included cash accounts use incompatible currencies and no approved conversion policy is configured.");if(/access|permission|Denied|Authentication/i.test(message))throw new CashFlowLiquidityError("permission","Cash Flow access is not permitted.");throw new CashFlowLiquidityError("unavailable","Cash Flow and Liquidity could not be completed from the available sources.");}
  const key=cashFlowLiquidityCacheKey(input),cached=await cache?.get(key);if(cached)return cached;const view=buildCashFlowLiquidityView(input);await cache?.put(key,view);return view;
}
export class GetCashFlowLiquidity{constructor(private readonly reader:CashFlowLiquidityReader,private readonly cache?:CashFlowLiquidityCache){}execute(query:GetCashFlowLiquidityQuery){return getCashFlowLiquidity(this.reader,query,this.cache);}}

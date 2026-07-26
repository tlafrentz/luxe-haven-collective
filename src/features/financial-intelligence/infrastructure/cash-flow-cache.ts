import type { CashFlowLiquidityCache, CashFlowLiquidityView } from "../application";
export class InMemoryCashFlowLiquidityCache implements CashFlowLiquidityCache{
  private readonly values=new Map<string,CashFlowLiquidityView>();
  async get(key:string){return this.values.get(key)??null;}async put(key:string,value:CashFlowLiquidityView){this.values.set(key,value);}
  async invalidate(input:Readonly<{workspaceId:string;from?:string;reason:"account-balance"|"transaction-import"|"reclassification"|"transfer-rematch"|"obligation"|"reserve-policy"|"permission"|"account-access"|"backdated-entry"|"currency-conversion"|"reconciliation"}>){for(const[key,value]of this.values)if(value.identity.workspaceId===input.workspaceId&&(!input.from||value.period.to>=input.from))this.values.delete(key);}
  size(){return this.values.size;}
}

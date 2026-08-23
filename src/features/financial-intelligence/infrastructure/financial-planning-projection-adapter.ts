import { evaluatePropertyAccess, evaluateWorkspacePermission, type WorkspaceAccessContext } from "@/features/workspace";
import { buildFinancialReadModel, FinancialPlanningError, type FinancialPlanningReader, type FinancialPlanningRepository, type FinancialSource, type GetFinancialPlanningQuery } from "../application";
import type { FinancialPropertyCatalog } from "./financial-overview-projection-adapter";
import type { CashAccountBalanceReader } from "./cash-flow-projection-adapter";

export const emptyFinancialPlanningRepository:FinancialPlanningRepository={
  getApprovedBudget:async()=>null,getCurrentForecast:async()=>null,listScenarios:async()=>[],listPropertyPlans:async()=>[],
  saveBudgetRevision:async()=>{throw new FinancialPlanningError("configuration","A planning repository is not configured.")},
  saveForecastVersion:async()=>{throw new FinancialPlanningError("configuration","A planning repository is not configured.")},
};
export class FinancialPlanningProjectionAdapter implements FinancialPlanningReader{
  constructor(private readonly access:WorkspaceAccessContext,private readonly source:FinancialSource,private readonly catalog:FinancialPropertyCatalog,private readonly repository:FinancialPlanningRepository=emptyFinancialPlanningRepository,private readonly balances?:CashAccountBalanceReader){}
  async read(query:GetFinancialPlanningQuery){
    if(query.workspaceId!==this.access.workspaceId||!evaluateWorkspacePermission(this.access,"financial.planning.summary.view"))throw new FinancialPlanningError("permission","Financial Planning access is not permitted.");
    const all=await this.catalog.list(query.workspaceId),eligible=all.filter(x=>x.included&&x.reportingEligible&&evaluatePropertyAccess(this.access,x.propertyId)),requested=query.propertyIds?[...new Set(query.propertyIds)]:undefined;
    if(requested?.some(id=>!eligible.some(x=>x.propertyId===id)))throw new FinancialPlanningError("permission","A selected property is outside the authorized planning scope.");
    const properties=eligible.filter(x=>!requested||requested.includes(x.propertyId)),propertyIds=properties.map(x=>x.propertyId).sort(),evaluatedAt=query.evaluatedAt??new Date().toISOString();
    const scope=Object.freeze({type:query.portfolioId?"portfolio"as const:propertyIds.length===1?"single-property"as const:requested?"selected-properties"as const:"workspace"as const,label:query.portfolioId?"Authorized Portfolio":propertyIds.length===1?properties[0]?.label??"Single Property":requested?"Selected Properties":this.access.propertyAccess.type==="all"?"Full Workspace":"Authorized Properties",propertyIds:Object.freeze(propertyIds),propertyCount:propertyIds.length});
    const actuals=await buildFinancialReadModel(this.source,{access:this.access,workspaceId:query.workspaceId,propertyIds,period:query.period,evaluatedAt,authorizationLevel:"read"});
    const [budget,forecast,scenarios,propertyPlanRecords,propertyActuals,cashBalances]=await Promise.all([
      this.repository.getApprovedBudget(query.workspaceId,scope,query.period),
      this.repository.getCurrentForecast(query.workspaceId,scope,query.period,query.forecastVersion),
      this.repository.listScenarios(query.workspaceId,scope,query.period),
      this.repository.listPropertyPlans(query.workspaceId,propertyIds,query.period),
      Promise.all(properties.map(async property=>({propertyId:property.propertyId,label:property.label,actuals:await buildFinancialReadModel(this.source,{access:this.access,workspaceId:query.workspaceId,propertyIds:[property.propertyId],period:query.period,evaluatedAt,authorizationLevel:"read"})}))),
      this.balances?.read({workspaceId:query.workspaceId,propertyIds,period:query.period,asOf:query.period.to})??Promise.resolve([]),
    ]);
    const plans=new Map(propertyPlanRecords.map(x=>[x.propertyId,x]));
    return Object.freeze({actuals,cashPositionAvailable:cashBalances.some(balance=>Boolean(balance.closingBalance)),scope,budget,forecast,scenarios:Object.freeze(scenarios.filter(x=>!query.scenarioIds||query.scenarioIds.includes(x.id))),propertyPlans:Object.freeze(propertyActuals.map(x=>({...x,budget:plans.get(x.propertyId)?.budget,forecast:plans.get(x.propertyId)?.forecast}))),canViewPlanning:true,canEditForecast:evaluateWorkspacePermission(this.access,"financial.forecast.edit"),canApproveBudget:evaluateWorkspacePermission(this.access,"financial.budget.approve"),permissionLimited:this.access.propertyAccess.type!=="all"||!evaluateWorkspacePermission(this.access,"financial.planning.view"),evaluatedAt,projectionVersion:`planning-v1:${actuals.evaluatedAt}`});
  }
}

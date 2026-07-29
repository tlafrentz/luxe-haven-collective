import { Money } from "@/platform/kernel";
import type { FinancialSnapshot } from "../domain";

export function toRevenueFinancialProjection(snapshot:FinancialSnapshot){
  return Object.freeze({snapshotId:snapshot.id,basis:snapshot.basis,period:snapshot.period,recognizedRevenue:snapshot.valuesByBasis.actual.revenue,revenueVariance:snapshot.variances.find(item=>item.metric==="revenue"),confidence:snapshot.confidence,lineage:snapshot.lineage.revenue});
}
export function toInvestmentActualPerformance(snapshot:FinancialSnapshot){
  return Object.freeze({snapshotId:snapshot.id,period:snapshot.period,operatingExpenses:snapshot.profitability.operatingExpenses,noi:snapshot.profitability.noi,cashFlow:snapshot.profitability.netCashFlow,capital:snapshot.capital,variances:snapshot.variances,confidence:snapshot.confidence});
}
export function toExecutiveFinancialHealth(snapshot:FinancialSnapshot){
  return Object.freeze({snapshotId:snapshot.id,period:snapshot.period,health:snapshot.health,noi:snapshot.profitability.noi,cashFlow:snapshot.profitability.netCashFlow,expenseRatio:snapshot.profitability.expenseRatio,capital:snapshot.capital,risks:snapshot.risks,confidence:snapshot.confidence});
}
export function aggregatePortfolioFinancialSnapshots(snapshots:readonly FinancialSnapshot[]){
  if(!snapshots.length)throw new Error("PORTFOLIO_FINANCIAL_SNAPSHOTS_REQUIRED");
  const first=snapshots[0],currency=first.revenue?.currency??first.expenses?.currency,period=first.period;
  if(!currency||snapshots.some(item=>item.basis!==first.basis||item.period.from!==period.from||item.period.to!==period.to))throw new Error("PORTFOLIO_FINANCIAL_SCOPE_MISMATCH");
  const complete=snapshots.every(item=>item.profitability.grossRevenue&&item.profitability.operatingExpenses&&item.profitability.noi);
  if(!complete)throw new Error("PORTFOLIO_FINANCIAL_EVIDENCE_INCOMPLETE");
  const sum=(select:(snapshot:FinancialSnapshot)=>Money|null)=>snapshots.reduce((total,item)=>total.add(select(item)!),Money.zero(currency));
  const revenue=sum(item=>item.profitability.grossRevenue),expenses=sum(item=>item.profitability.operatingExpenses),noi=sum(item=>item.profitability.noi),cashFlow=snapshots.every(item=>item.profitability.netCashFlow)?sum(item=>item.profitability.netCashFlow):null;
  return Object.freeze({snapshotIds:Object.freeze(snapshots.map(item=>item.id).sort()),basis:first.basis,period,revenue,expenses,noi,cashFlow,expenseRatio:revenue.amount?expenses.amount/revenue.amount:null,confidence:snapshots.some(item=>item.confidence==="insufficient-evidence")?"insufficient-evidence":snapshots.some(item=>item.confidence==="low")?"low":snapshots.some(item=>item.confidence==="moderate")?"moderate":"high"});
}

export function deriveFinancialSnapshotLessons(actual:FinancialSnapshot,baseline:FinancialSnapshot){
  if(actual.workspaceId!==baseline.workspaceId||actual.period.from!==baseline.period.from||actual.period.to!==baseline.period.to||actual.basis!=="actual"||baseline.basis==="actual")throw new Error("FINANCIAL_LEARNING_SNAPSHOT_SCOPE_MISMATCH");
  return Object.freeze(actual.variances.filter(item=>item.basis===baseline.basis&&item.direction!=="on-plan").map(item=>Object.freeze({
    id:`financial-lesson:${actual.id}:${baseline.id}:${item.metric}`,
    actualSnapshotId:actual.id,baselineSnapshotId:baseline.id,basis:baseline.basis,
    category:item.metric,lesson:`${item.metric.replace("-"," ")} was ${item.direction} to ${baseline.basis}.`,
    magnitude:item.magnitude,confidence:item.confidence,evidenceIds:item.evidenceIds,
  })));
}

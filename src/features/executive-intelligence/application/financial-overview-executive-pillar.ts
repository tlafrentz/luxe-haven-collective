import type { FinancialOverview } from "@/features/financial-intelligence";
import type { ExecutivePillarInput } from "./build-executive-business-health";

const scoreByStatus={strong:90,stable:75,"attention-needed":55,"at-risk":25,"insufficient-evidence":null}as const;
const confidenceByLevel={high:90,moderate:70,low:40,"insufficient-evidence":null}as const;

/** Executive policy projection over Financial Intelligence; no financial metric is recalculated here. */
export function financialOverviewExecutivePillar(financial:FinancialOverview):ExecutivePillarInput{
  const artifactId=`financial-overview:${financial.projectionVersion}`;
  const risks=financial.attention.map(item=>item.title);
  const opportunities=financial.condition.positiveDrivers;
  return Object.freeze({pillar:"financial",score:scoreByStatus[financial.condition.status],confidence:confidenceByLevel[financial.confidence],
    evidence:Object.freeze([{capability:"financial" as const,artifactType:"financial-projection",artifactId,
      period:{from:financial.period.from,to:financial.period.to},confidence:confidenceByLevel[financial.confidence]??0,
      destination:"/dashboard/financial",summary:financial.condition.summary}]),
    limitations:Object.freeze([...financial.condition.limitingConditions,...financial.evidence.gaps]),risks:Object.freeze(risks),opportunities:Object.freeze(opportunities),
    ...(risks[0]?{recommendation:{title:risks[0],whyItMatters:financial.attention[0]?.whyItMatters??financial.condition.summary,
      suggestedNextAction:"Open Financial Intelligence and inspect the supporting evidence.",businessImpact:financial.condition.status==="at-risk"?100:70,destination:"/dashboard/financial"}}:{}),
    changes:Object.freeze(financial.changes.map(change=>({id:`executive-financial-change:${change.id}`,occurredAt:financial.evaluatedAt,type:change.category==="revenue"?"revenue" as const:change.category==="cash"?"capital" as const:"health" as const,title:change.title,summary:change.description,destination:"/dashboard/financial"}))),
  });
}

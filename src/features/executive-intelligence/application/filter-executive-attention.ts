import type { ExecutiveAttentionItem, ExecutiveAttentionSummary } from "../domain";
export const executiveAttentionFilters=["all","performance","risk","data-quality"] as const;
export type ExecutiveAttentionFilter=(typeof executiveAttentionFilters)[number];
export function parseExecutiveAttentionFilter(value:string|undefined):ExecutiveAttentionFilter{return executiveAttentionFilters.includes(value as ExecutiveAttentionFilter)?value as ExecutiveAttentionFilter:"all"}
export function filterExecutiveAttention(attention:ExecutiveAttentionSummary,filter:ExecutiveAttentionFilter):ExecutiveAttentionSummary{if(filter==="all")return attention;const riskIds=new Set(attention.risks.map(item=>item.id));const priorities=attention.priorities.filter(item=>filter==="risk"?riskIds.has(item.id):filter==="data-quality"?isDataQuality(item):isPerformance(item)&&!riskIds.has(item.id));const ids=new Set(priorities.map(item=>item.id));return Object.freeze({priorities:Object.freeze(priorities),risks:Object.freeze(attention.risks.filter(item=>ids.has(item.id))),opportunities:Object.freeze(attention.opportunities.filter(item=>ids.has(item.id)))})}
const dataQualityTerms=["data-quality","data quality","freshness","stale","evidence","confidence","provider","unavailable-data","incomplete-scope","unsupported-metric"];
const performanceTerms=["revenue","pricing","occupancy","distribution","operations","operational","performance","booking","anomaly","opportunity"];
function normalized(item:ExecutiveAttentionItem){return `${item.category} ${item.title}`.toLowerCase()}
function isDataQuality(item:ExecutiveAttentionItem){const value=normalized(item);return dataQualityTerms.some(term=>value.includes(term))}
function isPerformance(item:ExecutiveAttentionItem){const value=normalized(item);return !isDataQuality(item)&&performanceTerms.some(term=>value.includes(term))}

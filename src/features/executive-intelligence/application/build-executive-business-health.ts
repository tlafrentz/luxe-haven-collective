import { HPM_PILLARS, HPM_PILLAR_QUESTIONS, type HpmPillar } from "@/features/hpm";
import type {
  ExecutiveBusinessHealthProjection,ExecutiveEvidenceReference,ExecutiveHealthAttentionItem,
  ExecutiveHealthTimelineItem,ExecutivePillarProjection,ExecutiveRecommendation,
} from "../domain";

export type ExecutivePillarInput=Readonly<{
  pillar:HpmPillar;score:number|null;confidence:number|null;evidence:readonly ExecutiveEvidenceReference[];
  limitations?:readonly string[];risks?:readonly string[];opportunities?:readonly string[];
  recommendation?:Readonly<{title:string;whyItMatters:string;suggestedNextAction:string;businessImpact:number;destination:string}>;
  changes?:readonly Omit<ExecutiveHealthTimelineItem,"pillar"|"evidenceIds">[];
}>;
export type BuildExecutiveBusinessHealthInput=Readonly<{
  workspaceId:string;period:Readonly<{from:string;to:string}>;generatedAt:string;pillars:readonly ExecutivePillarInput[];
}>;

export function buildExecutiveBusinessHealth(input:BuildExecutiveBusinessHealthInput):ExecutiveBusinessHealthProjection{
  const supplied=new Map(input.pillars.map(item=>[item.pillar,item]));
  if(supplied.size!==input.pillars.length)throw new Error("DUPLICATE_EXECUTIVE_HEALTH_PILLAR");
  const pillars=Object.fromEntries(HPM_PILLARS.map(pillar=>{
    const source=supplied.get(pillar),evidence=Object.freeze([...(source?.evidence??[])].sort((a,b)=>a.artifactId.localeCompare(b.artifactId)));
    const score=evidence.length?valid(source?.score):null,confidence=evidence.length?valid(source?.confidence):null;
    const limitations=Object.freeze([...(source?.limitations??(source?[]:[`No canonical ${pillar} projection is available.`])),...(source&&source.score!==null&&!evidence.length?[`The ${pillar} score was excluded because it has no canonical evidence lineage.`]:[])]);
    const projection:ExecutivePillarProjection=Object.freeze({pillar,score,confidence,status:healthStatus(score),question:HPM_PILLAR_QUESTIONS[pillar],
      evidence,limitations,risks:Object.freeze(source?.risks??[]),opportunities:Object.freeze(source?.opportunities??[]),recommendation:source?.recommendation?.title??null});
    return[pillar,projection];
  })) as Record<HpmPillar,ExecutivePillarProjection>;
  const available=HPM_PILLARS.map(pillar=>pillars[pillar]).filter(item=>item.score!==null);
  const score=available.length?round(available.reduce((total,item)=>total+item.score!,0)/available.length):null;
  const confidenceValues=available.flatMap(item=>item.confidence===null?[]:[item.confidence]);
  const confidenceScore=confidenceValues.length?round(confidenceValues.reduce((total,value)=>total+value,0)/confidenceValues.length):null;
  const evidence=Object.freeze(HPM_PILLARS.flatMap(pillar=>pillars[pillar].evidence));
  const recommendations=Object.freeze(input.pillars.flatMap(source=>{
    const value=source.recommendation;if(!value)return[];
    const evidenceIds=Object.freeze(source.evidence.map(item=>item.artifactId).sort());
    return[Object.freeze({id:`executive-recommendation:${source.pillar}:${fingerprint(evidenceIds.join("|"))}`,pillar:source.pillar,
      ...value,confidence:valid(source.confidence),evidenceIds}) satisfies ExecutiveRecommendation];
  }));
  const candidates=HPM_PILLARS.flatMap(pillar=>{
    const value=pillars[pillar],destination=value.evidence[0]?.destination??null,evidenceIds=Object.freeze(value.evidence.map(item=>item.artifactId));
    const risks=value.risks.map((title,index)=>candidate("risk",pillar,title,`Canonical ${pillar} evidence identifies this risk.`,value,index,destination,evidenceIds));
    const opportunities=value.opportunities.map((title,index)=>candidate("opportunity",pillar,title,`Canonical ${pillar} evidence identifies this opportunity.`,value,index,destination,evidenceIds));
    const unknowns=value.limitations.map((title,index)=>candidate("unknown",pillar,title,"Missing evidence limits executive confidence without reducing the pillar score.",value,index,null,evidenceIds));
    return[...risks,...opportunities,...unknowns];
  });
  const attention=Object.freeze(candidates.sort((a,b)=>b.attentionScore-a.attentionScore||a.id.localeCompare(b.id)).map((item,index)=>Object.freeze({...item,rank:index+1})));
  const timeline=Object.freeze(input.pillars.flatMap(source=>(source.changes??[]).map(change=>Object.freeze({...change,pillar:source.pillar,evidenceIds:Object.freeze(source.evidence.map(item=>item.artifactId))}))).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||a.id.localeCompare(b.id)));
  const artifactIds=Object.freeze([...new Set(evidence.map(item=>item.artifactId))].sort());
  return Object.freeze({id:`executive-health-${fingerprint(`${input.workspaceId}|${input.period.from}|${input.period.to}|${artifactIds.join("|")}`)}`,
    schemaVersion:"executive-business-health.v1",workspaceId:input.workspaceId,period:Object.freeze({...input.period}),generatedAt:input.generatedAt,
    score,status:projectionStatus(score),pillars:Object.freeze(pillars),confidence:Object.freeze({score:confidenceScore,coverage:available.length/HPM_PILLARS.length,
      availablePillars:available.length,totalPillars:HPM_PILLARS.length,byPillar:Object.freeze(Object.fromEntries(HPM_PILLARS.map(pillar=>[pillar,pillars[pillar].confidence])) as Record<HpmPillar,number|null>),
      limitations:Object.freeze(HPM_PILLARS.flatMap(pillar=>pillars[pillar].limitations))}),attention,recommendations,timeline,evidence,
    lineage:Object.freeze({artifactIds,calculationVersion:"executive-health.v1"})});
}
function valid(value:number|null|undefined){return typeof value==="number"&&Number.isFinite(value)?Math.max(0,Math.min(100,value)):null}
function round(value:number){return Math.round(value*100)/100}
function healthStatus(score:number|null):ExecutivePillarProjection["status"]{return score===null?"unavailable":score>=70?"healthy":score>=40?"watch":"critical"}
function projectionStatus(score:number|null):ExecutiveBusinessHealthProjection["status"]{return score===null?"unavailable":score>=90?"excellent":score>=75?"healthy":score>=60?"watch":score>=40?"needs-attention":"critical"}
function candidate(kind:ExecutiveHealthAttentionItem["kind"],pillar:HpmPillar,title:string,why:string,value:ExecutivePillarProjection,index:number,destination:string|null,evidenceIds:readonly string[]):ExecutiveHealthAttentionItem{
  const urgency=value.status==="critical"?"critical":value.status==="watch"?"high":kind==="unknown"?"medium":"low";
  const impact=kind==="risk"?100-(value.score??50):kind==="opportunity"?Math.max(10,100-(value.score??50)):50;
  const confidence=value.confidence,timeSensitivity=urgency==="critical"?100:urgency==="high"?75:urgency==="medium"?50:25,businessValue=impact;
  const attentionScore=({critical:400,high:300,medium:200,low:100}[urgency])+impact+(confidence??0)*.5+timeSensitivity*.5+businessValue;
  return Object.freeze({id:`executive-attention:${pillar}:${kind}:${index}:${fingerprint(title)}`,rank:0,kind,pillar,title,why,urgency,impact,confidence,timeSensitivity,businessValue,attentionScore,destination,evidenceIds});
}
function fingerprint(value:string){let hash=2166136261;for(let index=0;index<value.length;index++)hash=Math.imul(hash^value.charCodeAt(index),16777619);return(hash>>>0).toString(16).padStart(8,"0")}

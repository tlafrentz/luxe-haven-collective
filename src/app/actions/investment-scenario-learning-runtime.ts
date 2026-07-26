"use server";
import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildScenarioLearningProjection, type ScenarioOutcomeMetricKey, type ScenarioOutcomeRevision } from "@/features/investment-opportunity";
import { getInvestmentScenarioWorkspaceRequest } from "./investment-scenario-runtime";

type Row=Record<string,unknown>;

export async function getInvestmentScenarioLearningRequest(opportunityId:string,scenarioId?:string){
  const workspaceResult=await getInvestmentScenarioWorkspaceRequest(opportunityId);
  if(!workspaceResult.ok)return workspaceResult;
  const scenario=workspaceResult.workspace.scenarios.find(item=>item.id===scenarioId)??workspaceResult.workspace.preferredScenario??workspaceResult.workspace.scenarios[0];
  if(!scenario)return{ok:true as const,workspace:workspaceResult.workspace,scenario:null,projection:null,outcomes:[],observations:[],activity:[],similar:[]};
  const client=await createClient();
  const[{data:outcomeRows},{data:observationRows},{data:activityRows},{data:similarRows}]=await Promise.all([
    client.from("investment_scenario_outcome_revisions").select("*").eq("scenario_id",scenario.id).order("revision",{ascending:false}).limit(100),
    client.from("investment_scenario_observations").select("*").eq("scenario_id",scenario.id).order("observed_at",{ascending:false}).limit(100),
    client.from("investment_scenario_learning_activity").select("*").eq("scenario_id",scenario.id).order("occurred_at",{ascending:false}).limit(200),
    client.from("investment_scenario_outcome_revisions").select("id,scenario_id,opportunity_id,recommendation_outcome,confidence,created_at").neq("scenario_id",scenario.id).order("created_at",{ascending:false}).limit(50),
  ]);
  const outcomes=(outcomeRows??[]).map(mapOutcome),latest=outcomes[0];
  const projection=buildScenarioLearningProjection(scenario,latest);
  const candidateIds=(similarRows??[]).map(row=>String(row.scenario_id));
  const{data:metadataRows}=candidateIds.length?await client.from("investment_scenarios").select("scenario_id,scenario_type").in("scenario_id",candidateIds):{data:[]};
  const scenarioTypes=new Map((metadataRows??[]).map(row=>[String(row.scenario_id),String(row.scenario_type)]));
  const similar=(similarRows??[]).map(row=>{const confidence=String(row.confidence),sameStrategy=scenarioTypes.get(String(row.scenario_id))===scenario.type,similarity=(sameStrategy?80:45)+(confidence==="high"?10:confidence==="moderate"?5:0);return Object.freeze({scenarioId:String(row.scenario_id),opportunityId:String(row.opportunity_id),similarity,outcome:String(row.recommendation_outcome),confidence});}).filter(item=>item.similarity>=60).sort((a,b)=>b.similarity-a.similarity).slice(0,5);
  const successful=similar.filter(item=>item.outcome==="successful").length;
  const pattern=similar.length?Object.freeze({sampleSize:similar.length,summary:`${successful} of ${similar.length} similar measured ${scenario.type.replaceAll("-"," ")} scenarios recorded successful outcomes.`,confidence:similar.length>=5?"moderate"as const:"low"as const}):null;
  return{ok:true as const,workspace:workspaceResult.workspace,scenario,projection,outcomes,observations:(observationRows??[])as Row[],activity:(activityRows??[])as Row[],similar,pattern};
}

export async function recordInvestmentScenarioOutcomeAction(formData:FormData){
  const opportunityId=value(formData,"opportunityId"),scenarioId=value(formData,"scenarioId"),periodStart=value(formData,"periodStart"),periodEnd=value(formData,"periodEnd");
  const metrics:Partial<Record<ScenarioOutcomeMetricKey,number>>={};
  for(const key of METRIC_KEYS){const raw=value(formData,key);if(raw!==""){const parsed=Number(raw);if(!Number.isFinite(parsed))throw new Error("scenario_outcome_invalid");metrics[key]=parsed;}}
  if(!opportunityId||!scenarioId||!periodStart||!periodEnd||Object.keys(metrics).length===0)throw new Error("scenario_outcome_invalid");
  const source=value(formData,"evidenceSource")||"manual-observation",label=value(formData,"evidenceLabel").trim()||"Operator-recorded operating outcome",confidence=value(formData,"confidence")||"moderate";
  const client=await createClient(),{error}=await client.rpc("record_investment_scenario_outcome",{p_opportunity_id:opportunityId,p_scenario_id:scenarioId,p_outcome_id:`scenario-outcome-${crypto.randomUUID()}`,p_command_id:value(formData,"commandId")||crypto.randomUUID(),p_period_start:periodStart,p_period_end:periodEnd,p_actual_metrics:metrics,p_recommendation_outcome:value(formData,"recommendationOutcome")||"insufficient-data",p_confidence:confidence,p_evidence:[{source,label,quality:confidence==="insufficient-evidence"?"low":confidence}]});
  if(error)throw new Error(safeError(error.message));
  revalidate(opportunityId);redirect(`/dashboard/investments/opportunities/${opportunityId}/learning?scenario=${encodeURIComponent(scenarioId)}`);
}

export async function addInvestmentScenarioObservationAction(formData:FormData){
  const opportunityId=value(formData,"opportunityId"),scenarioId=value(formData,"scenarioId"),body=value(formData,"body").trim();
  if(!opportunityId||!scenarioId||!body||body.length>5000)throw new Error("scenario_observation_invalid");
  const client=await createClient(),{error}=await client.rpc("add_investment_scenario_observation",{p_opportunity_id:opportunityId,p_scenario_id:scenarioId,p_observation_id:`scenario-observation-${crypto.randomUUID()}`,p_command_id:value(formData,"commandId")||crypto.randomUUID(),p_body:body,p_observed_at:value(formData,"observedAt")||new Date().toISOString()});
  if(error)throw new Error(safeError(error.message));
  revalidate(opportunityId);redirect(`/dashboard/investments/opportunities/${opportunityId}/learning?scenario=${encodeURIComponent(scenarioId)}`);
}

const METRIC_KEYS:readonly ScenarioOutcomeMetricKey[]=["annualRevenue","adr","occupancy","operatingExpenses","noi","annualCashFlow","cashOnCashReturn"];
function mapOutcome(row:Row):ScenarioOutcomeRevision{return Object.freeze({id:String(row.id),scenarioId:String(row.scenario_id),opportunityId:String(row.opportunity_id),revision:Number(row.revision),periodStart:String(row.period_start),periodEnd:String(row.period_end),actualMetrics:Object.freeze((row.actual_metrics??{})as Partial<Record<ScenarioOutcomeMetricKey,number>>),recommendationOutcome:String(row.recommendation_outcome)as ScenarioOutcomeRevision["recommendationOutcome"],confidence:String(row.confidence)as ScenarioOutcomeRevision["confidence"],evidence:Object.freeze((Array.isArray(row.evidence)?row.evidence:[])as ScenarioOutcomeRevision["evidence"]),createdBy:String(row.created_by_profile_id),createdAt:String(row.created_at)});}
function value(data:FormData,key:string){return String(data.get(key)??"");}
function revalidate(id:string){revalidatePath(`/dashboard/investments/opportunities/${id}/learning`);revalidatePath(`/dashboard/investments/opportunities/${id}/scenarios`);revalidatePath("/dashboard/reports/new");}
function safeError(message:string){return message.includes("permission")?"You don't have permission to record scenario outcomes.":message.includes("idempotency")?"This command identity was already used for different outcome data.":"Unable to record the scenario outcome. Your historical forecast was not changed.";}

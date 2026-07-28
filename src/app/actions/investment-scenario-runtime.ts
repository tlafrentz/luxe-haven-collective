"use server";
import "server-only";
import {
  createInvestmentOpportunityId,
  createOpportunityOwnerId,
  getInvestmentScenarioWorkspace,
  compareInvestmentScenarios,
} from "@/features/investment-opportunity";
import { getInvestmentOpportunityRequestContext } from "./investment-opportunity-runtime";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getInvestmentScenarioWorkspaceRequest(opportunityId: string) {
  const context = await getInvestmentOpportunityRequestContext();
  if (!context.ok) return { ok: false as const, code: "SCENARIO_NOT_AUTHENTICATED" as const };
  try {
    if(!await context.authorizeOpportunity(opportunityId,"scenario.read"))return{ok:false as const,code:"SCENARIO_NOT_FOUND" as const};
    const opportunity = await context.repository.findById(
      createInvestmentOpportunityId(opportunityId),
      createOpportunityOwnerId(context.ownerId),
    );
    if (!opportunity) return { ok: false as const, code: "SCENARIO_NOT_FOUND" as const };
    const client=await createClient();
    const[{data:records},{data:events},{data:pointer}]=await Promise.all([
      client.from("investment_scenarios").select("*").eq("opportunity_id",opportunityId),
      client.from("investment_scenario_events").select("*").eq("opportunity_id",opportunityId).order("occurred_at",{ascending:false}).limit(200),
      client.from("investment_opportunities").select("preferred_scenario_id").eq("id",opportunityId).maybeSingle(),
    ]);
    return {
      ok: true as const,
      workspace: getInvestmentScenarioWorkspace(opportunity, {
        actorId: context.ownerId,
        canManage: true,
        records:(records??[]).map(row=>({scenarioId:row.scenario_id,sourceAnalysisVersionId:row.source_analysis_version_id,name:row.name,scenarioType:row.scenario_type,description:row.description??undefined,notes:row.notes??undefined,status:row.status,revision:row.revision,assumptions:(row.assumptions_snapshot??{}) as Readonly<Record<string,string|number|boolean>>,output:row.output_snapshot,createdBy:row.created_by_profile_id,createdAt:row.created_at,updatedAt:row.updated_at,archivedAt:row.archived_at??undefined})),
        events:(events??[]).map(row=>({id:row.id,scenarioId:row.scenario_id,eventType:row.event_type,safeSummary:row.safe_summary,occurredAt:row.occurred_at})),
        preferredScenarioId:pointer?.preferred_scenario_id??undefined,
      }),
    };
  } catch {
    return { ok: false as const, code: "SCENARIO_UNAVAILABLE" as const };
  }
}

export async function getInvestmentScenarioComparisonRequest(opportunityId:string,requestedIds?:readonly string[]){
  const workspaceResult=await getInvestmentScenarioWorkspaceRequest(opportunityId);if(!workspaceResult.ok)return workspaceResult;
  const client=await createClient(),{data:{user}}=await client.auth.getUser();if(!user)return{ok:false as const,code:"SCENARIO_NOT_AUTHENTICATED"as const};
  const{data:session}=await client.from("investment_scenario_comparison_sessions").select("scenario_ids,updated_at").eq("opportunity_id",opportunityId).eq("profile_id",user.id).maybeSingle();
  const persistedIds=Array.isArray(session?.scenario_ids)?session.scenario_ids.map(String):[];
  const fallback=workspaceResult.workspace.activeScenarios.slice(0,4).map(item=>item.id),ids=(requestedIds?.length?requestedIds:persistedIds.length?persistedIds:fallback).slice(0,4);
  const scenarios=ids.flatMap((id:string)=>{const found=workspaceResult.workspace.scenarios.find(item=>item.id===id);return found?[found]:[]});
  if(scenarios.length<2)return{ok:true as const,workspace:workspaceResult.workspace,selectedIds:ids,projection:null,message:workspaceResult.workspace.scenarios.length<2?"Compare scenarios by creating another investment strategy.":"One or more selected scenarios are no longer available. Select at least two scenarios."};
  try{return{ok:true as const,workspace:workspaceResult.workspace,selectedIds:ids,projection:compareInvestmentScenarios(scenarios),message:null};}catch(error){return{ok:true as const,workspace:workspaceResult.workspace,selectedIds:ids,projection:null,message:error instanceof Error?error.message:"Comparison is unavailable."};}
}

export async function saveScenarioComparisonSelectionAction(formData:FormData){
  const opportunityId=String(formData.get("opportunityId")??""),scenarioIds=formData.getAll("scenarioId").map(String).filter(Boolean);
  if(scenarioIds.length<2||scenarioIds.length>4)throw new Error("Select between two and four scenarios.");
  const client=await createClient(),{error}=await client.rpc("save_scenario_comparison_session",{p_opportunity_id:opportunityId,p_scenario_ids:scenarioIds});
  if(error)throw new Error(scenarioError(error.message));
  redirect(`/dashboard/investments/opportunities/${opportunityId}/compare?${scenarioIds.map(id=>`scenario=${encodeURIComponent(id)}`).join("&")}`);
}

export async function createInvestmentScenarioAction(formData:FormData){
  const opportunityId=String(formData.get("opportunityId")??""),sourceAnalysisVersionId=String(formData.get("sourceAnalysisVersionId")??""),sourceScenarioId=String(formData.get("sourceScenarioId")??""),expectedVersion=Number(formData.get("expectedVersion")),name=String(formData.get("name")??"").trim(),type=String(formData.get("scenarioType")??"custom");
  if(!opportunityId||!sourceAnalysisVersionId||!name||!Number.isInteger(expectedVersion)||!["base","cash-purchase","rental-arbitrage","seller-financing","custom"].includes(type))throw new Error("scenario_invalid");
  const context=await getInvestmentOpportunityRequestContext();if(!context.ok||!await context.authorizeOpportunity(opportunityId,"scenario.create",sourceAnalysisVersionId))throw new Error("scenario_permission_denied");
  const client=await createClient(),scenarioId=`scenario-${crypto.randomUUID()}`,commandId=String(formData.get("commandId")??crypto.randomUUID());
  const{data,error}=await client.rpc("create_investment_scenario",{p_opportunity_id:opportunityId,p_source_analysis_version_id:sourceAnalysisVersionId,p_source_scenario_id:sourceScenarioId,p_scenario_id:scenarioId,p_name:name,p_scenario_type:type,p_description:String(formData.get("description")??"").trim(),p_notes:String(formData.get("notes")??"").trim(),p_expected_version:expectedVersion,p_command_id:commandId});
  if(error)throw new Error(scenarioError(error.message));
  const persistedScenarioId=data?.[0]?.scenario_id??scenarioId;
  console.info("investment_scenario_created",{commandId,opportunityId,analysisVersionId:sourceAnalysisVersionId,scenarioId:persistedScenarioId,sourceScenarioId:sourceScenarioId||null});
  revalidateScenario(opportunityId);redirect(`/dashboard/investments/opportunities/${opportunityId}/scenarios/${persistedScenarioId}`);
}

export async function mutateInvestmentScenarioAction(formData:FormData){
  const opportunityId=String(formData.get("opportunityId")??""),scenarioId=String(formData.get("scenarioId")??""),operation=String(formData.get("operation")??"save"),expectedVersion=Number(formData.get("expectedVersion")),expectedRevision=Number(formData.get("expectedRevision"));
  if(!opportunityId||!scenarioId||!["save","archive","restore","preferred"].includes(operation)||!Number.isInteger(expectedVersion)||!Number.isInteger(expectedRevision))throw new Error("scenario_invalid");
  const context=await getInvestmentOpportunityRequestContext();if(!context.ok||!await context.authorizeOpportunity(opportunityId,"scenario.modify"))throw new Error("scenario_permission_denied");
  const client=await createClient(),{error}=await client.rpc("mutate_investment_scenario",{p_opportunity_id:opportunityId,p_scenario_id:scenarioId,p_operation:operation,p_name:String(formData.get("name")??"").trim(),p_description:String(formData.get("description")??"").trim(),p_notes:String(formData.get("notes")??"").trim(),p_expected_scenario_revision:expectedRevision,p_expected_version:expectedVersion,p_command_id:String(formData.get("commandId")??crypto.randomUUID())});
  if(error)throw new Error(scenarioError(error.message));
  revalidateScenario(opportunityId);
}
export type ScenarioSaveState=Readonly<{ok:boolean;message:string}>;
export async function saveInvestmentScenarioDetailsAction(_state:ScenarioSaveState,formData:FormData):Promise<ScenarioSaveState>{
  const opportunityId=String(formData.get("opportunityId")??""),scenarioId=String(formData.get("scenarioId")??""),expectedVersion=Number(formData.get("expectedVersion")),expectedRevision=Number(formData.get("expectedRevision"));
  if(!opportunityId||!scenarioId||!Number.isInteger(expectedVersion)||!Number.isInteger(expectedRevision))return{ok:false,message:"The scenario save request is incomplete."};
  const client=await createClient(),{data,error}=await client.rpc("mutate_investment_scenario",{p_opportunity_id:opportunityId,p_scenario_id:scenarioId,p_operation:"save",p_name:String(formData.get("name")??"").trim(),p_description:String(formData.get("description")??"").trim(),p_notes:String(formData.get("notes")??"").trim(),p_expected_scenario_revision:expectedRevision,p_expected_version:expectedVersion,p_command_id:String(formData.get("commandId")??crypto.randomUUID())});
  if(error)return{ok:false,message:scenarioError(error.message)};
  revalidateScenario(opportunityId);return{ok:true,message:data?.[0]?.changed===false?"No changes to save.":"Scenario saved and confirmed by the server."};
}
function revalidateScenario(id:string){revalidatePath(`/dashboard/investments/opportunities/${id}`);revalidatePath(`/dashboard/investments/opportunities/${id}/scenarios`);revalidatePath(`/dashboard/investments/opportunities/${id}/compare`);revalidatePath("/dashboard/reports/new");}
function scenarioError(message:string){return message.includes("scenario_stale")?"This scenario changed since you opened it. Reload before saving.":message.includes("permission")?"You don't have permission to edit this scenario.":message.includes("preferred_cannot_archive")?"Select another preferred scenario before archiving this one.":message.includes("source_required")?"Run an investment analysis before creating scenarios.":"Unable to save the scenario. Retry without losing your work.";}

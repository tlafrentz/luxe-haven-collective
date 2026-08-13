import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STANDARD_REPORT_DEFINITIONS, validateStandardReportDefinition, type StandardReportDefinition } from "./standard-report-catalog";
import { ReportFoundationError } from "./model";

const stable=(value:unknown):string=>Array.isArray(value)?`[${value.map(stable).join(",")}]`:value&&typeof value==="object"?`{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(",")}}`:JSON.stringify(value);
export const standardReportDefinitionFingerprint=(definition:StandardReportDefinition)=>{const validated=validateStandardReportDefinition(definition),{status:_,...immutableContract}=validated;return createHash("sha256").update(stable(immutableContract)).digest("hex");};

export class RegisterStandardReportCatalog {
  constructor(private readonly client:SupabaseClient){}
  async execute(input:Readonly<{actorId:string;correlationId:string}>){const results=[];for(const definition of STANDARD_REPORT_DEFINITIONS){const{data,error}=await this.client.rpc("register_standard_report_definition",{p_actor_id:input.actorId,p_contract:definition,p_fingerprint:standardReportDefinitionFingerprint(definition),p_correlation_id:`${input.correlationId}:${definition.reportCode}:${definition.version}`});if(error)throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION",error.code==="P0001"?"Standard report registration failed closed.":"Standard report registration is unavailable.");results.push(data);}return Object.freeze(results);}
}

export class TransitionStandardReportDefinition {
  constructor(private readonly client:SupabaseClient){}
  async execute(input:Readonly<{actorId:string;reportCode:string;version:number;action:"approve"|"activate"|"retire";reasonCode:string;expectedRevision:number;correlationId:string}>){const{data,error}=await this.client.rpc("transition_standard_report_definition",{p_actor_id:input.actorId,p_report_code:input.reportCode,p_version:input.version,p_action:input.action,p_reason_code:input.reasonCode,p_expected_revision:input.expectedRevision,p_correlation_id:input.correlationId});if(error)throw new ReportFoundationError(error.message.includes("STALE")?"REPORT_CONCURRENT_MODIFICATION":"REPORT_INVALID_CONFIGURATION","Standard report transition failed closed.");return data;}
}

export class ManageStandardReportDraft {
  constructor(private readonly client:SupabaseClient){}
  async clone(input:Readonly<{actorId:string;reportCode:string;sourceVersion:number;newVersion:number;reasonCode:string;correlationId:string}>){const{data,error}=await this.client.rpc("clone_standard_report_definition",{p_actor_id:input.actorId,p_report_code:input.reportCode,p_source_version:input.sourceVersion,p_new_version:input.newVersion,p_reason_code:input.reasonCode,p_correlation_id:input.correlationId});if(error)throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION","Standard report draft clone failed closed.");return data;}
  async replace(input:Readonly<{actorId:string;definition:StandardReportDefinition;reasonCode:string;expectedRevision:number;correlationId:string}>){if(input.definition.status!=="draft")throw new ReportFoundationError("REPORT_INVALID_CONFIGURATION","Only draft definitions may be edited.");validateStandardReportDefinition(input.definition);const{data,error}=await this.client.rpc("replace_standard_report_draft",{p_actor_id:input.actorId,p_contract:input.definition,p_fingerprint:standardReportDefinitionFingerprint(input.definition),p_reason_code:input.reasonCode,p_expected_revision:input.expectedRevision,p_correlation_id:input.correlationId});if(error)throw new ReportFoundationError(error.message.includes("STALE")?"REPORT_CONCURRENT_MODIFICATION":"REPORT_INVALID_CONFIGURATION","Standard report draft update failed closed.");return data;}
}

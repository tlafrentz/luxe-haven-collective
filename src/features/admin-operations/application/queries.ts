import "server-only";
import { createClient } from "@/lib/supabase/server";
import { INTEGRATION_REGISTRY, configurationStatus, type IntegrationId, type RuntimeStatus } from "../domain/integration-registry";
import { calculateHealth, calculateSuccessRate, type AdminAuditEvent, type ProviderHealthObservation, type SyncAttempt } from "../domain/operations";
import type { ReportingPeriod } from "./reporting-period";

const canonicalId = (value:string): IntegrationId => value === "realtyapi" ? "realty_api" : value as IntegrationId;
export type AdminIntegration = Readonly<{ definition:(typeof INTEGRATION_REGISTRY)[number]; configurationStatus:ReturnType<typeof configurationStatus>; runtimeStatus:RuntimeStatus; lastSuccessfulActivity?:string; lastFailedActivity?:string; recentSuccessRate?:number; relatedCount?:number }>;

export async function listAdminIntegrations(): Promise<readonly AdminIntegration[]> {
  const db = await createClient();
  const since = new Date(Date.now()-7*86_400_000).toISOString();
  const [attemptsResult, healthResult, settingsResult, propertiesResult] = await Promise.all([
    db.from("sync_attempts").select("integration_id,status,started_at").gte("started_at",since).order("started_at",{ascending:false}),
    db.from("provider_health_observations").select("integration_id,observed_at,outcome,latency_ms,failure_classification,source,capability").gte("observed_at",since).order("observed_at",{ascending:false}),
    db.from("integration_runtime_settings").select("integration_id,enabled"),
    db.from("external_properties").select("provider"),
  ]);
  const attempts = attemptsResult.error ? [] : attemptsResult.data ?? [];
  const observations = healthResult.error ? [] : healthResult.data ?? [];
  const settings = new Map((settingsResult.error ? [] : settingsResult.data ?? []).map((row) => [row.integration_id,row.enabled]));
  return INTEGRATION_REGISTRY.map((definition) => {
    const providerAttempts = attempts.filter((row) => canonicalId(row.integration_id)===definition.id);
    const providerObservations = observations.filter((row) => canonicalId(row.integration_id)===definition.id).map((row)=>({id:`projection:${definition.id}:${row.observed_at}`,integrationId:definition.id,observedAt:row.observed_at,outcome:row.outcome,...(row.latency_ms===null?{}:{latencyMs:row.latency_ms}),...(row.failure_classification?{failureClassification:row.failure_classification}:{}),source:row.source,...(row.capability?{capability:row.capability}:{})})) as ProviderHealthObservation[];
    const lastSuccess = providerAttempts.find((row) => row.status === "succeeded")?.started_at ?? providerObservations.find((row) => row.outcome === "success")?.observedAt;
    const lastFailure = providerAttempts.find((row) => row.status === "failed")?.started_at ?? providerObservations.find((row) => row.outcome !== "success")?.observedAt;
    const health = calculateHealth(providerObservations);
    return { definition, configurationStatus: settings.get(definition.id)===false ? "disabled" : configurationStatus(definition), runtimeStatus: health === "partial_outage" ? "unavailable" : health === "outage" ? "unavailable" : health,
      ...(lastSuccess?{lastSuccessfulActivity:lastSuccess}:{}), ...(lastFailure?{lastFailedActivity:lastFailure}:{}),
      ...(calculateSuccessRate(providerAttempts.map((row)=>row.status as SyncAttempt["status"]))===undefined?{}:{recentSuccessRate:calculateSuccessRate(providerAttempts.map((row)=>row.status as SyncAttempt["status"]))}),
      ...(definition.id==="hospitable"?{relatedCount:(propertiesResult.error?[]:propertiesResult.data??[]).filter((row)=>row.provider==="hospitable").length}:{}) };
  });
}

export async function getAdminIntegrationDetails(id:IntegrationId) { return (await listAdminIntegrations()).find((item)=>item.definition.id===id) ?? null; }

export async function listSyncAttempts(period:ReportingPeriod, filters:Readonly<Record<string,string|undefined>>={}) {
  const db=await createClient();let query=db.from("sync_attempts").select("*").gte("started_at",period.from).lte("started_at",period.to).order("started_at",{ascending:false}).order("id",{ascending:false}).limit(100);
  if(filters.provider)query=query.eq("integration_id",filters.provider);if(filters.status)query=query.eq("status",filters.status);if(filters.trigger)query=query.eq("trigger",filters.trigger);if(filters.capability)query=query.eq("capability",filters.capability);if(filters.correlationId)query=query.eq("correlation_id",filters.correlationId);
  const {data,error}=await query;if(error)throw new Error("Unable to load synchronization attempts.");
  return (data??[]).map((row)=>({id:row.id,correlationId:row.correlation_id,integrationId:canonicalId(row.integration_id),capability:row.capability,trigger:row.trigger,direction:row.direction,status:row.status,startedAt:row.started_at,...(row.completed_at?{completedAt:row.completed_at}:{}),...(row.duration_ms===null?{}:{durationMs:row.duration_ms}),...(row.records_examined===null?{}:{recordsExamined:row.records_examined}),...(row.records_created===null?{}:{recordsCreated:row.records_created}),...(row.records_updated===null?{}:{recordsUpdated:row.records_updated}),...(row.records_skipped===null?{}:{recordsSkipped:row.records_skipped}),...(row.records_failed===null?{}:{recordsFailed:row.records_failed}),...(row.failure_classification?{failureClassification:row.failure_classification}:{}),...(row.safe_failure_message?{safeFailureMessage:row.safe_failure_message}:{})})) as SyncAttempt[];
}
export async function getSyncAttemptDetails(id:string){const db=await createClient();const{data,error}=await db.from("sync_attempts").select("*").eq("id",id).maybeSingle();if(error)throw new Error("Unable to load synchronization attempt.");return data;}

export async function getProviderHealthSummary(period:ReportingPeriod){const db=await createClient();const{data,error}=await db.from("provider_health_observations").select("*").gte("observed_at",period.from).lte("observed_at",period.to).order("observed_at",{ascending:false}).limit(2000);if(error)throw new Error("Unable to load provider health.");const rows=(data??[]).map((row)=>({id:row.id,integrationId:canonicalId(row.integration_id),...(row.capability?{capability:row.capability}:{}),observedAt:row.observed_at,outcome:row.outcome,...(row.latency_ms===null?{}:{latencyMs:row.latency_ms}),...(row.failure_classification?{failureClassification:row.failure_classification}:{}),source:row.source})) as ProviderHealthObservation[];return INTEGRATION_REGISTRY.map((definition)=>{const observations=rows.filter((row)=>row.integrationId===definition.id);const latencies=observations.flatMap((row)=>row.latencyMs===undefined?[]:[row.latencyMs]);return{definition,status:calculateHealth(observations),successRate:observations.length?Math.round(observations.filter((row)=>row.outcome==="success").length/observations.length*1000)/10:undefined,averageLatencyMs:latencies.length?Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length):undefined,lastChecked:observations[0]?.observedAt,incidents:observations.filter((row)=>row.outcome!=="success").length,observations};});}
export async function getProviderHealthDetails(id:IntegrationId,period:ReportingPeriod){return(await getProviderHealthSummary(period)).find((item)=>item.definition.id===id)??null;}

export async function listAdminAuditEvents(period:ReportingPeriod,filters:Readonly<Record<string,string|undefined>>={}){const db=await createClient();let query=db.from("admin_audit_events").select("*").gte("occurred_at",period.from).lte("occurred_at",period.to).order("occurred_at",{ascending:false}).order("id",{ascending:false}).limit(100);if(filters.actor)query=query.eq("actor_id",filters.actor);if(filters.action)query=query.eq("action",filters.action);if(filters.category)query=query.eq("category",filters.category);if(filters.result)query=query.eq("result",filters.result);if(filters.targetType)query=query.eq("target_type",filters.targetType);if(filters.correlationId)query=query.eq("correlation_id",filters.correlationId);const{data,error}=await query;if(error)throw new Error("Unable to load administrative audit events.");return(data??[]).map((row)=>({id:row.id,occurredAt:row.occurred_at,...(row.actor_id?{actorId:row.actor_id}:{}),...(row.actor_role?{actorRole:row.actor_role}:{}),action:row.action,category:row.category,...(row.target_type?{targetType:row.target_type}:{}),...(row.target_id?{targetId:row.target_id}:{}),result:row.result,...(row.correlation_id?{correlationId:row.correlation_id}:{}),source:row.source,metadata:row.metadata??{}})) as AdminAuditEvent[];}

export async function listSupportTickets(period:ReportingPeriod,filters:Readonly<Record<string,string|undefined>>={}){const db=await createClient();let query=db.from("support_tickets").select("id,ticket_number,workspace_id,customer_id,source_inquiry_id,subject,status,priority,assigned_admin_id,created_at,updated_at,resolved_at,closed_at").gte("created_at",period.from).lte("created_at",period.to).order("updated_at",{ascending:false}).order("id",{ascending:false}).limit(100);if(filters.status)query=query.eq("status",filters.status);if(filters.priority)query=query.eq("priority",filters.priority);if(filters.assignee)query=query.eq("assigned_admin_id",filters.assignee);if(filters.customer)query=query.eq("customer_id",filters.customer);if(filters.source==="inquiry")query=query.not("source_inquiry_id","is",null);if(filters.search)query=query.ilike("subject",`%${filters.search.replaceAll("%","")}%`);const{data,error}=await query;if(error)throw new Error("Unable to load support tickets.");return data??[];}
export async function getSupportTicket(id:string){const db=await createClient();const[ticket,messages,activity]=await Promise.all([db.from("support_tickets").select("*").eq("id",id).maybeSingle(),db.from("support_ticket_messages").select("*").eq("ticket_id",id).order("created_at"),db.from("support_ticket_activity").select("*").eq("ticket_id",id).order("occurred_at")]);if(ticket.error||messages.error||activity.error)throw new Error("Unable to load support ticket.");return ticket.data?{ticket:ticket.data,messages:messages.data??[],activity:activity.data??[]}:null;}

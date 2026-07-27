import { createAdminClient } from "@/lib/supabase/admin";
import { getHospitableReservationMessages,normalizeHospitableMessage } from "./messages";
import { runInBatches } from "./run-in-batches";

const PROVIDER="hospitable";
const CONNECTION_NAME="Hospitable Primary";
const MAX_RUNNING_SYNC_AGE_MINUTES=30;
export const MESSAGE_SYNC_ALREADY_RUNNING_ERROR="A Hospitable message sync is already running.";

type ReservationConversationRow=Readonly<{booking_id:string;reservation_id:string;conversation_id:string}>;
export type MessageSyncOptions=Readonly<{batchSize?:number;workspaceId?:string;mode?:"manual"|"automatic"|"incremental"|"recovery"}>;
export type MessageSyncResult=Readonly<{
  connectionId:string;
  reservations:number;
  processed:number;
  created:number;
  updated:number;
  skipped:number;
  failed:number;
  errors:readonly string[];
}>;

export async function syncHospitableMessages(options:MessageSyncOptions={}):Promise<MessageSyncResult>{
  const batchSize=options.batchSize??5;
  if(!Number.isInteger(batchSize)||batchSize<1||batchSize>10)throw new Error("Message sync batch size must be between 1 and 10.");
  const admin=createAdminClient();
  let connectionQuery=admin.from("integration_connections").select("id,workspace_id").eq("provider",PROVIDER).eq("name",CONNECTION_NAME);
  if(options.workspaceId)connectionQuery=connectionQuery.eq("workspace_id",options.workspaceId);
  const{data:connection,error:connectionError}=await connectionQuery.maybeSingle();
  if(connectionError)throw new Error(`Unable to load Hospitable connection: ${connectionError.message}`);
  if(!connection)throw new Error("Hospitable connection was not found. Run the property sync first.");
  const connectionId=String(connection.id),workspaceId=String(connection.workspace_id);
  await expireStaleRuns(connectionId);
  const syncRunId=await startRun(connectionId,options.mode??"manual");
  const result={connectionId,reservations:0,processed:0,created:0,updated:0,skipped:0,failed:0,errors:[]as string[]};
  try{
    const{data:links,error:linkError}=await admin.from("guest_conversation_reservations").select("booking_id,reservation_id,conversation_id,guest_conversations!inner(workspace_id)").eq("guest_conversations.workspace_id",workspaceId);
    if(linkError)throw new Error(`Unable to load Hospitable reservations for message sync: ${linkError.message}`);
    const rows=(links??[])as unknown as ReservationConversationRow[];
    result.reservations=rows.length;
    await runInBatches({items:rows,batchSize,handler:async(link:ReservationConversationRow)=>{
      try{
        const messages=await getHospitableReservationMessages(link.reservation_id);
        for(const raw of messages){
          const message=normalizeHospitableMessage(raw);
          if(!message){result.failed+=1;result.errors.push(`Reservation ${link.reservation_id} returned an unsupported message.`);continue;}
          const{data:inserted,error}=await admin.rpc("append_guest_provider_message",{
            p_workspace_id:workspaceId,
            p_conversation_id:String(link.conversation_id),
            p_provider:PROVIDER,
            p_provider_message_id:message.providerMessageId,
            p_sender_type:message.senderType,
            p_sender_display_name:message.senderDisplayName,
            p_body:message.body,
            p_message_channel:message.platform,
            p_direction:message.direction,
            p_occurred_at:message.occurredAt,
            p_backfill:true,
          });
          result.processed+=1;
          if(error){result.failed+=1;result.errors.push(`Message ${message.providerMessageId}: ${error.message}`);}
          else if(inserted)result.created+=1;
          else result.skipped+=1;
        }
      }catch(error){
        result.failed+=1;
        result.errors.push(`Reservation ${link.reservation_id}: ${error instanceof Error?error.message:"Unexpected message sync failure."}`);
      }
    }});
    await finishRun(syncRunId,result);
    await admin.from("integration_connections").update({last_successful_sync_at:new Date().toISOString(),last_failed_sync_at:null}).eq("id",connectionId);
    return Object.freeze({...result,errors:Object.freeze([...result.errors])});
  }catch(error){
    await failRun(syncRunId,error);
    await admin.from("integration_connections").update({last_failed_sync_at:new Date().toISOString()}).eq("id",connectionId);
    throw error;
  }
}

async function expireStaleRuns(connectionId:string){
  const admin=createAdminClient(),completedAt=new Date().toISOString(),staleBefore=new Date(Date.now()-MAX_RUNNING_SYNC_AGE_MINUTES*60_000).toISOString();
  const{error}=await admin.from("integration_sync_runs").update({status:"failed",completed_at:completedAt,error_message:"Sync automatically failed after exceeding the maximum running time."}).eq("connection_id",connectionId).eq("sync_type","messages").eq("status","running").lt("started_at",staleBefore);
  if(error)throw new Error(`Unable to expire stale message syncs: ${error.message}`);
}

async function startRun(connectionId:string,mode:string){
  const{data,error}=await createAdminClient().from("integration_sync_runs").insert({connection_id:connectionId,sync_type:"messages",status:"running",synchronization_mode:mode,provider_version:"hospitable-messaging-v1"}).select("id").single();
  if(error?.code==="23505")throw new Error(MESSAGE_SYNC_ALREADY_RUNNING_ERROR);
  if(error)throw new Error(`Unable to start message sync: ${error.message}`);
  return String(data.id);
}

async function finishRun(syncRunId:string,result:{processed:number;created:number;updated:number;failed:number;reservations:number;skipped:number;errors:string[]}){
  const status=result.failed===0?"completed":result.processed===0?"failed":"partial";
  const{error}=await createAdminClient().from("integration_sync_runs").update({status,completed_at:new Date().toISOString(),records_processed:result.processed,records_created:result.created,records_updated:result.updated,records_failed:result.failed,error_message:result.errors.length?result.errors.join("\n"):null,metadata:{reservations:result.reservations,skipped:result.skipped}}).eq("id",syncRunId);
  if(error)throw new Error(`Unable to finish message sync: ${error.message}`);
}

async function failRun(syncRunId:string,error:unknown){
  await createAdminClient().from("integration_sync_runs").update({status:"failed",completed_at:new Date().toISOString(),error_message:error instanceof Error?error.message:"Unexpected message sync failure."}).eq("id",syncRunId);
}

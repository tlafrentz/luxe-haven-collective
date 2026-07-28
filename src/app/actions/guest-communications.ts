"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import {
  evaluatePropertyAccess,
  evaluateWorkspacePermission,
  resolveWorkspaceAccessContext,
  SupabaseTeamAccessRepository,
} from "@/features/workspace";
import {
  getReservationContext,
  SupabaseReservationContextRepository,
} from "@/features/reservation-context";
import { DEFAULT_MESSAGING_PROVIDER_REGISTRY, providerFailure } from "@/features/integrations";
import { hydrateHospitableReservationMessageHistory } from "@/features/integrations/hospitable";
import { assertCanonicalMessagingWorkspace, resolveHospitableMessagingWorkspace } from "@/features/integrations/hospitable/lib/messaging-workspace";
import { buildConversationProjection, buildGuestContextProjection, createConversationAggregate, evaluateCommunicationGuidance, type CanonicalMessage, type CommunicationAttachment, type ConversationActivity, type ConversationParticipant, type ConversationReservationLink, type DeliveryEvent, type InternalCommunicationNote, type ProviderThreadReference } from "@/features/guest-communications";
import {buildCanonicalPropertyProjection} from "@/features/property-projection";

type ConversationRow = {
  id: string; workspace_id: string; reservation_id: string; booking_id: string;
  guest_id: string; property_id: string; channel: string; status: string;
  assigned_to_profile_id: string | null; unread_count: number;
  last_activity_at: string; revision: number;
  waiting_on?:string;priority?:string;active_reservation_id?:string;created_at?:string;updated_at?:string;
};

async function authorize(workspaceId?: string, permission: "communications.view" | "communications.reply" | "communications.manage" = "communications.view") {
  const { user } = await getSessionProfile();
  if (!user) throw new Error("permission_denied");
  const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, workspaceId);
  if (!evaluateWorkspacePermission(access, permission)) throw new Error("permission_denied");
  return { user, access };
}

async function authorizeLegacyCommunicationWorkspace(
  messagingWorkspaceId: string,
  permission: "communications.view" | "communications.reply" | "communications.manage" = "communications.view",
) {
  const result = await authorize(undefined, permission);
  assertCanonicalMessagingWorkspace(result.access.workspaceId, messagingWorkspaceId);
  return result;
}

export async function getGuestCommunicationInbox(input: { workspaceId?: string; query?: string; status?: string; sort?:string; page?:number;propertyId?:string;stage?:string;priority?:string } = {}) {
  try {
    const { access } = await authorize(input.workspaceId);
    const admin = createAdminClient();
    const page=Math.max(1,input.page??1),pageSize=50,from=(page-1)*pageSize;
    const { data, error } = await admin.from("guest_conversations").select("*").eq("workspace_id", access.workspaceId).order("last_activity_at", { ascending: false }).range(from,from+pageSize-1);
    if (error) throw error;
    const allowed = (data as ConversationRow[]).filter(row => evaluatePropertyAccess(access, row.property_id));
    const guestIds = [...new Set(allowed.map(row => row.guest_id))];
    const propertyIds = [...new Set(allowed.map(row => row.property_id))];
    const bookingIds=[...new Set(allowed.map(row=>row.booking_id))];
    const conversationIds=allowed.map(row=>row.id);
    const [{ data: guests }, { data: properties },{data:bookings},{data:messages},{data:notes}] = await Promise.all([
      guestIds.length ? admin.from("guests").select("id,display_name").in("id", guestIds) : Promise.resolve({ data: [] }),
      propertyIds.length ? admin.from("properties").select("id,name").in("id", propertyIds) : Promise.resolve({ data: [] }),
      bookingIds.length?admin.from("bookings").select("id,check_in,check_out,status,source,last_synced_at").in("id",bookingIds):Promise.resolve({data:[]}),
      conversationIds.length?admin.from("guest_communication_messages").select("conversation_id,body,sender_type,created_at,delivery_status").in("conversation_id",conversationIds).order("created_at",{ascending:false}):Promise.resolve({data:[]}),
      conversationIds.length?admin.from("guest_communication_notes").select("conversation_id,body").in("conversation_id",conversationIds):Promise.resolve({data:[]}),
    ]);
    const guestNames = new Map((guests ?? []).map((row: { id: string; display_name: string }) => [row.id, row.display_name]));
    const propertyNames = new Map((properties ?? []).map((row: { id: string; name: string }) => [row.id, row.name]));
    const query = input.query?.trim().toLowerCase();
    const bookingMap=new Map((bookings??[]).map(row=>[String(row.id),row])),lastMessages=new Map<string,Record<string,unknown>>(),searchText=new Map<string,string[]>();
    for(const message of messages??[]){if(!lastMessages.has(String(message.conversation_id)))lastMessages.set(String(message.conversation_id),message);}
    for(const item of [...(messages??[]),...(notes??[])])searchText.set(String(item.conversation_id),[...(searchText.get(String(item.conversation_id))??[]),String(item.body)]);
    const today=new Date().toISOString().slice(0,10);
    const conversations = allowed.filter(row => {
      if(input.status==="open-issues"&&!["waiting-on-operator","open"].includes(row.status))return false;
      if(input.status==="waiting-on-operator"&&row.status!=="waiting-on-operator")return false;
      if (input.status && !["open-issues","waiting-on-operator"].includes(input.status) && row.status !== input.status) return false;
      if(input.propertyId&&row.property_id!==input.propertyId)return false;
      if (!query) return true;
      const booking=bookingMap.get(row.booking_id);
      return [row.reservation_id,row.booking_id,guestNames.get(row.guest_id),propertyNames.get(row.property_id),booking?.source,booking?.check_in,booking?.check_out,...(searchText.get(row.id)??[])].some(value => String(value??"").toLowerCase().includes(query));
    }).map(row => {
      const booking=bookingMap.get(row.booking_id),lastMessage=lastMessages.get(row.id),arrival=String(booking?.check_in??""),departure=String(booking?.check_out??"");
      const stayStatus=arrival===today?"arrival-today":departure===today?"departure-today":arrival<today&&departure>today?"in-stay":String(booking?.status??"unknown");
      if(input.stage&&stayStatus!==input.stage)return null;
      const priority=row.priority??(row.unread_count>0&&["arrival-today","in-stay","departure-today"].includes(stayStatus)?"urgent":row.unread_count>0||row.status==="waiting-on-operator"?"high":"normal");
      if(input.priority&&priority!==input.priority)return null;
      return ({
      ...row,
      guestName: guestNames.get(row.guest_id) ?? "Guest",
      propertyName: propertyNames.get(row.property_id) ?? "Property",
      stayStatus,arrival,departure,bookingSource:String(booking?.source??row.channel),synchronizationAt:booking?.last_synced_at??null,
      lastMessage:lastMessage?String(lastMessage.body):"No message preview",waitingOn:(row.waiting_on??"none").replace(/^\w/,letter=>letter.toUpperCase()),
      priority,
    })}).filter((item):item is NonNullable<typeof item>=>item!==null);
    const ranked=[...conversations].sort((a,b)=>input.sort==="arrival-today"?Number(b.stayStatus==="arrival-today")-Number(a.stayStatus==="arrival-today"):input.sort==="in-stay"?Number(b.stayStatus==="in-stay")-Number(a.stayStatus==="in-stay"):input.sort==="departure-today"?Number(b.stayStatus==="departure-today")-Number(a.stayStatus==="departure-today"):input.sort==="requires-reply"?Number(b.status==="waiting-on-operator")-Number(a.status==="waiting-on-operator"):Date.parse(b.last_activity_at)-Date.parse(a.last_activity_at));
    const[{data:provider},{data:reviewQueue}]=await Promise.all([admin.from("integration_connections").select("provider,status,last_successful_sync_at").eq("workspace_id",access.workspaceId).in("status",["active","error","authorization-expired"]).limit(1).maybeSingle(),admin.from("messaging_provider_review_queue").select("id,provider,reason,occurred_at,reservation_reference").eq("workspace_id",access.workspaceId).eq("status","pending").order("created_at",{ascending:false}).limit(25)]);
    return { ok: true as const, workspaceId: access.workspaceId, conversations:ranked,page,pageSize,properties:(properties??[]).map(item=>({id:String(item.id),name:String(item.name)})),reviewQueue:reviewQueue??[],canReviewProviderMessages:evaluateWorkspacePermission(access,"communications.manage"),provider:provider?{connected:provider.status==="active",status:provider.status,lastSynchronizedAt:provider.last_successful_sync_at}:null };
  } catch (error) {
    console.error("guest_communications_inbox_failed", { errorType: error instanceof Error ? error.message : "unexpected" });
    return { ok: false as const, code: "permission_denied", conversations: [] };
  }
}

export async function getGuestCommunicationWorkspaceRequest(conversationId: string) {
  try {
    const admin = createAdminClient();
    const { data: candidate } = await admin.from("guest_conversations").select("*").eq("id", conversationId).maybeSingle();
    if (!candidate) return { ok: false as const, code: "conversation_not_found" };
    const row = candidate as ConversationRow;
    const { access } = await authorizeLegacyCommunicationWorkspace(row.workspace_id);
    if (!evaluatePropertyAccess(access, row.property_id)) return { ok: false as const, code: "permission_denied" };
    const canViewContact = access.role === "owner" || access.role === "administrator";
    // The Supabase reservation repository resolves the caller's workspace
    // membership from their profile id before applying its property scope.
    const principal = { userId: access.profileId, workspaceId: access.profileId, role: access.role === "owner" ? "owner" as const : access.role === "administrator" ? "admin" as const : "cleaner" as const };
    const reservation = await getReservationContext(new SupabaseReservationContextRepository(), principal, row.booking_id, canViewContact ? "operational-contact" : "operational-summary");
    if (!reservation) return { ok: false as const, code: "reservation_not_found" };
    const [{ data: messages }, { data: notes }, { data: timeline }, { data: templates }, { data: links }, { data: guidebook },{data:draft},{data:attachments},{data:attempts},{data:connection},{data:participants},{data:reservationLinks},{data:providerThreads},{data:deliveryEvents},{data:activity},{data:propertyDetails},{data:maintenance},{count:previousStayCount},{count:previousConversationCount},{data:recommendationRows}] = await Promise.all([
      admin.from("guest_communication_messages").select("*").eq("conversation_id", conversationId).order("created_at"),
      admin.from("guest_communication_notes").select("*").eq("conversation_id", conversationId).order("pinned", { ascending: false }).order("created_at", { ascending: false }),
      admin.from("guest_communication_timeline").select("*").eq("conversation_id", conversationId).order("occurred_at"),
      admin.from("guest_communication_templates").select("*").or(`workspace_id.is.null,workspace_id.eq.${access.workspaceId}`).eq("publication_status","published").order("title"),
      admin.from("guest_communication_action_links").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: false }),
      admin.from("guidebooks").select("id,title,public_slug,published_version,status,updated_at").eq("property_id", row.property_id).eq("status", "published").maybeSingle(),
      admin.from("guest_communication_drafts").select("*").eq("conversation_id",conversationId).eq("profile_id",access.profileId).maybeSingle(),
      admin.from("guest_communication_attachments").select("*").eq("conversation_id",conversationId).order("created_at"),
      admin.from("guest_communication_delivery_attempts").select("*").eq("conversation_id",conversationId).order("started_at",{ascending:false}).limit(50),
      admin.from("integration_connections").select("provider,status,last_successful_sync_at").eq("workspace_id",access.workspaceId).order("last_successful_sync_at",{ascending:false}).limit(1).maybeSingle(),
      admin.from("guest_conversation_participants").select("*").eq("conversation_id",conversationId).order("joined_at"),
      admin.from("guest_conversation_reservations").select("*").eq("conversation_id",conversationId).order("linked_at"),
      admin.from("guest_conversation_provider_threads").select("*").eq("conversation_id",conversationId).order("last_observed_at"),
      admin.from("guest_message_delivery_events").select("*").eq("conversation_id",conversationId).order("occurred_at"),
      admin.from("guest_conversation_activity").select("*").eq("conversation_id",conversationId).order("occurred_at"),
      admin.from("properties").select("id,name,slug,status,address,address_line_1,city,state,timezone,check_in_time,check_out_time,amenities,house_rules,featured_image,updated_at").eq("id",row.property_id).maybeSingle(),
      admin.from("maintenance_requests").select("id,priority,description,status,created_at").eq("property_id",row.property_id).neq("status","resolved").order("created_at",{ascending:false}).limit(20),
      admin.from("bookings").select("id",{count:"exact",head:true}).eq("primary_guest_id",row.guest_id).neq("id",row.booking_id).eq("status","completed"),
      admin.from("guest_conversations").select("id",{count:"exact",head:true}).eq("workspace_id",row.workspace_id).eq("guest_id",row.guest_id).neq("id",conversationId),
      admin.from("guest_communication_recommendations").select("*").eq("conversation_id",conversationId),
    ]);
    const providerAdapter=connection?.provider?DEFAULT_MESSAGING_PROVIDER_REGISTRY.get(String(connection.provider)):undefined,providerHealth=providerAdapter?await providerAdapter.health({connectionStatus:String(connection?.status??"disconnected"),...(connection?.last_successful_sync_at?{lastSuccessfulSyncAt:String(connection.last_successful_sync_at)}:{})}):null;
    const provider={connected:connection?.status==="active",status:connection?.status??"not-connected",...(connection?.last_successful_sync_at?{lastSynchronizedAt:String(connection.last_successful_sync_at)}:{}),...(providerHealth?{health:providerHealth.state}:{}),...(providerAdapter?{adapterVersion:providerAdapter.version,capabilities:providerAdapter.capabilities}:{})},canReply=evaluateWorkspacePermission(access,"communications.reply")&&Boolean(providerAdapter?.capabilities.includes("send-messages"));
    const aggregate=mapConversationAggregate(row,{messages:messages??[],notes:notes??[],attachments:attachments??[],participants:participants??[],reservationLinks:reservationLinks??[],providerThreads:providerThreads??[],deliveryEvents:deliveryEvents??[],activity:activity??[]});
    const propertyProjection=propertyDetails?buildCanonicalPropertyProjection({id:String(propertyDetails.id),workspaceId:access.workspaceId,name:String(propertyDetails.name),slug:propertyDetails.slug?String(propertyDetails.slug):null,status:String(propertyDetails.status),address:String(propertyDetails.address_line_1??propertyDetails.address??"")||null,city:propertyDetails.city?String(propertyDetails.city):null,state:propertyDetails.state?String(propertyDetails.state):null,timezone:propertyDetails.timezone?String(propertyDetails.timezone):null,checkInTime:propertyDetails.check_in_time?String(propertyDetails.check_in_time):null,checkoutTime:propertyDetails.check_out_time?String(propertyDetails.check_out_time):null,amenities:Array.isArray(propertyDetails.amenities)?propertyDetails.amenities.map(String):[],houseRules:Array.isArray(propertyDetails.house_rules)?propertyDetails.house_rules.map(String):[],featuredImage:propertyDetails.featured_image?String(propertyDetails.featured_image):null,updatedAt:String(propertyDetails.updated_at)}):null,operational=propertyProjection?.operational,value=(field:keyof NonNullable<typeof propertyProjection>["operational"])=>{const item=operational?.[field];return item?.state==="available"&&typeof item.value==="string"?item.value:null};
    const guestContext=buildGuestContextProjection({
      workspaceId:access.workspaceId,conversation:aggregate,reservation,provider,
      permission:access.role==="owner"?"owner":access.role==="administrator"?"administrator":access.role==="operator"?"manager":"operational",
      property:{address:value("address"),amenities:propertyProjection?.guest.amenities??[],houseRules:operational?.houseRules.state==="available"&&Array.isArray(operational.houseRules.value)?operational.houseRules.value:[],doorCode:value("accessCode"),parking:value("parking"),wifi:value("wifi"),emergencyContact:value("emergencyContact"),updatedAt:propertyProjection?.updatedAt??null},
      guidebook:guidebook?{id:String(guidebook.id),status:String(guidebook.status),publicUrl:`/g/${guidebook.public_slug}`,version:guidebook.published_version===null?null:Number(guidebook.published_version),updatedAt:guidebook.updated_at?String(guidebook.updated_at):null}:null,
      issues:(maintenance??[]).map(issue=>({id:String(issue.id),type:"maintenance"as const,title:String(issue.description),status:String(issue.status),priority:String(issue.priority),createdAt:String(issue.created_at)})),
      history:{previousStayCount:previousStayCount??0,previousConversationCount:previousConversationCount??0,knownPreferences:[],guestSince:null},
      recentEvents:[...(timeline??[]).map(event=>({id:String(event.id),type:String(event.event_type),summary:String(event.safe_summary),occurredAt:String(event.occurred_at)})),...(activity??[]).map(event=>({id:String(event.id),type:String(event.event_type),summary:String(event.safe_summary),occurredAt:String(event.occurred_at)}))],
    });
    const normalizedTemplates=selectLocalizedTemplates(templates??[],reservation.guest.language??"en",access.workspaceId);
    const dispositions=(recommendationRows??[]).filter(item=>item.status==="completed"||item.status==="dismissed").map(item=>({actionKey:String(item.action_key),status:item.status as"completed"|"dismissed",contextFingerprint:String(item.context_fingerprint)})),guidance=evaluateCommunicationGuidance({context:guestContext,dispositions});
    await persistCommunicationGuidance({admin,workspaceId:row.workspace_id,conversationId,guidance,existing:recommendationRows??[]});
    const projection=buildConversationProjection({conversation:aggregate,reservation,guestContext,guidance,...(draft?{draft:{body:String(draft.body??""),...(draft.template_id?{templateId:String(draft.template_id)}:{}),updatedAt:String(draft.updated_at)}}:{}),templates:normalizedTemplates,providerState:provider,capabilities:{view:true,reply:canReply,archive:canReply,note:canReply,template:canReply}});
    return { ok: true as const, projection,conversation: row, reservation, messages: messages ?? [], notes: notes ?? [], timeline: timeline ?? [], templates: normalizedTemplates, actionLinks: links ?? [], guidebook: guidebook ? { ...guidebook, publicUrl: `/g/${guidebook.public_slug}` } : null,draft,attachments:attachments??[],deliveryAttempts:attempts??[],provider,suggestions:projection.suggestedActions,canReply };
  } catch (error) {
    console.error("guest_communication_workspace_failed", conversationId, error instanceof Error ? error.message : "unexpected");
    return { ok: false as const, code: error instanceof Error && error.message === "permission_denied" ? "permission_denied" : "unexpected" };
  }
}

export type GuestCommunicationComposerState=Readonly<{ok:boolean;message:string;messageId?:string}>;
export async function saveGuestCommunicationDraft(_state:GuestCommunicationComposerState,formData: FormData):Promise<GuestCommunicationComposerState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!conversationId || body.length > 10_000) return{ok:false,message:"Draft is invalid."};
  const admin = createAdminClient();
  const { data: candidate } = await admin.from("guest_conversations").select("*").eq("id", conversationId).maybeSingle();
  if (!candidate) throw new Error("conversation_not_found");
  const row = candidate as ConversationRow;
  const { access } = await authorizeLegacyCommunicationWorkspace(row.workspace_id, "communications.reply");
  if (!evaluatePropertyAccess(access, row.property_id)) throw new Error("permission_denied");
  const{error}=await createClient().then(client=>client.rpc("save_guest_communication_draft",{p_conversation_id:conversationId,p_body:body,p_template_id:String(formData.get("templateId")??"")||null}));
  if(error)return{ok:false,message:"Draft could not be saved. Your text remains in this browser."};
  return{ok:true,message:"Draft saved."};
}

export async function sendGuestCommunicationReplyAction(_state:GuestCommunicationComposerState,formData:FormData):Promise<GuestCommunicationComposerState>{
  const conversationId=String(formData.get("conversationId")??""),body=String(formData.get("body")??"").trim(),templateId=String(formData.get("templateId")??"")||null,idempotencyKey=String(formData.get("idempotencyKey")??crypto.randomUUID());
  if(!conversationId||!body||body.length>10000)return{ok:false,message:"Write a message of 10,000 characters or fewer."};
  const admin=createAdminClient(),{data:candidate}=await admin.from("guest_conversations").select("*").eq("id",conversationId).maybeSingle();
  if(!candidate)return{ok:false,message:"This conversation is no longer available."};
  const row=candidate as ConversationRow,{user,access}=await authorizeLegacyCommunicationWorkspace(row.workspace_id,"communications.reply");
  if(!evaluatePropertyAccess(access,row.property_id))return{ok:false,message:"You no longer have access to this conversation."};
  if(templateId&&/\{\{\w+\}\}/.test(body))return{ok:false,message:"Resolve every template variable before sending."};
  const client=await createClient(),messageId=`guest-message-${crypto.randomUUID()}`,{data:queued,error}=await client.rpc("queue_guest_communication_message",{p_conversation_id:conversationId,p_message_id:messageId,p_body:body,p_template_id:templateId,p_idempotency_key:idempotencyKey});
  if(error)return{ok:false,message:"The reply could not be queued. Your draft remains available."};
  const result=await deliverQueuedMessage({admin,row,messageId:String(queued??messageId),body});
  if(result.ok){
    const{data:guidebook}=await admin.from("guidebooks").select("id,active_version_id,public_slug").eq("property_id",row.property_id).eq("status","published").eq("public_url_status","active").maybeSingle();
    if(guidebook?.active_version_id&&body.includes(`/g/${guidebook.public_slug}`)){
      const deliveredAt=new Date().toISOString(),referenceBytes=new TextEncoder().encode(`${result.messageId}:${conversationId}:${guidebook.active_version_id}`),referenceHash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",referenceBytes))).map(value=>value.toString(16).padStart(2,"0")).join("");
      await Promise.all([
        admin.from("guidebook_guest_deliveries").insert({workspace_id:row.workspace_id,guidebook_id:guidebook.id,guidebook_version_id:guidebook.active_version_id,reservation_id:row.booking_id,guest_id:row.guest_id,conversation_id:conversationId,delivery_channel:"guest-communications",delivery_reference_hash:referenceHash,delivered_at:deliveredAt,metadata:{messageId:result.messageId}}),
        admin.from("guidebook_activity").insert({guidebook_id:guidebook.id,event_type:"guidebook-version-delivered",actor_profile_id:user.id,safe_summary:"The active guidebook version was delivered through Guest Communications.",metadata:{versionId:guidebook.active_version_id,conversationId,reservationId:row.booking_id,guestId:row.guest_id},occurred_at:deliveredAt}),
      ]);
    }
  }
  if(result.ok&&templateId){
    const{data:template}=await admin.from("guest_communication_templates").select("id,category,version").eq("id",templateId).eq("publication_status","published").maybeSingle();
    if(template){
      const occurredAt=new Date().toISOString();
      await admin.from("guest_communication_guidance_activity").insert({conversation_id:conversationId,workspace_id:row.workspace_id,template_id:template.id,actor_profile_id:user.id,event_type:"template-used",safe_summary:"Operator reviewed and sent resolved content from a published template version.",metadata:{messageId:result.messageId,templateVersion:template.version,category:template.category},occurred_at:occurredAt});
      const{data:completed}=await admin.from("guest_communication_recommendations").update({status:"completed",completed_at:occurredAt,acted_by:user.id}).eq("conversation_id",conversationId).eq("suggested_template_category",template.category).eq("status","active").select("id,action_key");
      if(completed?.length)await admin.from("guest_communication_guidance_activity").insert(completed.map(item=>({conversation_id:conversationId,workspace_id:row.workspace_id,recommendation_id:item.id,actor_profile_id:user.id,event_type:"recommendation-completed",safe_summary:"Sending the recommended reviewed template completed this communication action.",metadata:{actionKey:item.action_key,messageId:result.messageId},occurred_at:occurredAt})));
    }
  }
  revalidatePath(`/dashboard/communications/${conversationId}`);revalidatePath("/dashboard/communications");
  return result;
}

export async function retryGuestCommunicationDeliveryAction(formData:FormData){
  const messageId=String(formData.get("messageId")??""),admin=createAdminClient(),{data:message}=await admin.from("guest_communication_messages").select("*,guest_conversations!inner(*)").eq("id",messageId).eq("delivery_status","failed").maybeSingle();
  if(!message)throw new Error("communication_message_unavailable");
  const relation=message.guest_conversations as unknown as ConversationRow,{access}=await authorizeLegacyCommunicationWorkspace(relation.workspace_id,"communications.reply");
  if(!evaluatePropertyAccess(access,relation.property_id))throw new Error("permission_denied");
  const{data:lastAttempt}=await admin.from("guest_communication_delivery_attempts").select("retryable").eq("message_id",messageId).order("started_at",{ascending:false}).limit(1).maybeSingle();
  if(lastAttempt?.retryable===false)throw new Error("communication_retry_not_safe");
  await admin.from("messaging_provider_activity").insert({workspace_id:relation.workspace_id,provider:String(message.message_channel??"internal"),event_type:"delivery-retried",safe_summary:"Operator requested a safe retry for an existing canonical message.",metadata:{messageId},occurred_at:new Date().toISOString()});
  await admin.from("guest_communication_messages").update({delivery_status:"queued",failure_code:null}).eq("id",messageId).eq("delivery_status","failed");
  await deliverQueuedMessage({admin,row:relation,messageId,body:String(message.body)});
  revalidatePath(`/dashboard/communications/${relation.id}`);
}

export async function associateProviderReviewMessageAction(formData:FormData){
  const reviewId=String(formData.get("reviewId")??""),conversationId=String(formData.get("conversationId")??"");
  const admin=createAdminClient(),{data:review}=await admin.from("messaging_provider_review_queue").select("*").eq("id",reviewId).eq("status","pending").maybeSingle();
  if(!review?.workspace_id)throw new Error("provider_review_unavailable");
  const{user,access}=await authorizeLegacyCommunicationWorkspace(String(review.workspace_id),"communications.manage"),{data:conversation}=await admin.from("guest_conversations").select("*").eq("id",conversationId).eq("workspace_id",review.workspace_id).maybeSingle();
  if(!conversation||!evaluatePropertyAccess(access,String(conversation.property_id)))throw new Error("permission_denied");
  const{data:booking}=await admin.from("bookings").select("id,external_reservation_id,primary_guest_id,property_id,guest_full_name").eq("id",conversation.booking_id).maybeSingle();
  if(!booking?.primary_guest_id)throw new Error("provider_review_context_incomplete");
  const providerThread=String(review.provider_thread_reference??review.reservation_reference??"");
  if(!providerThread)throw new Error("provider_review_thread_missing");
  const{data:existingThread}=await admin.from("guest_conversation_provider_threads").select("conversation_id").eq("workspace_id",review.workspace_id).eq("provider",review.provider).eq("thread_id",providerThread).maybeSingle();
  if(existingThread&&existingThread.conversation_id!==conversationId)throw new Error("provider_review_conflict");
  if(!existingThread){const{error:threadError}=await admin.from("guest_conversation_provider_threads").insert({id:`provider-thread-${crypto.randomUUID()}`,conversation_id:conversationId,workspace_id:review.workspace_id,provider:review.provider,thread_id:providerThread,reservation_reference:booking.external_reservation_id??conversation.reservation_id,last_observed_at:review.occurred_at});if(threadError)throw new Error("provider_review_thread_conflict");}
  const{error}=await admin.rpc("ingest_guest_provider_message",{p_workspace_id:review.workspace_id,p_property_id:booking.property_id,p_booking_id:booking.id,p_conversation_id:conversationId,p_provider:review.provider,p_provider_message_id:review.provider_event_id,p_platform_message_id:null,p_provider_reservation_id:booking.external_reservation_id??conversation.reservation_id,p_provider_conversation_id:providerThread,p_sender_type:"guest",p_sender_display_name:booking.guest_full_name??"Guest",p_body:review.pending_message_body,p_content_type:"text/plain",p_message_channel:review.provider,p_direction:"inbound",p_delivery_status:"delivered",p_occurred_at:review.occurred_at,p_ingested_at:new Date().toISOString(),p_attachments:[],p_metadata:{reviewId},p_provenance:{provider:review.provider,source:"manual-review"},p_backfill:false});
  if(error)throw new Error("provider_review_association_failed");
  await admin.from("messaging_provider_review_queue").update({status:"associated",reviewed_by:user.id,reviewed_at:new Date().toISOString(),conversation_id:conversationId,pending_message_body:null}).eq("id",reviewId).eq("status","pending");
  revalidatePath("/dashboard/communications");revalidatePath(`/dashboard/communications/${conversationId}`);
}

export async function hydrateHospitableMessageHistoryAction(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const reservationId = String(formData.get("reservationId") ?? "");
  if (!conversationId || !reservationId) throw new Error("message_hydration_context_missing");
  const admin = createAdminClient();
  const { data: conversation } = await admin
    .from("guest_conversations")
    .select("id,workspace_id,property_id,reservation_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation || conversation.reservation_id !== reservationId) {
    throw new Error("conversation_not_found");
  }
  const { access } = await authorizeLegacyCommunicationWorkspace(
    String(conversation.workspace_id),
    "communications.manage",
  );
  if (!evaluatePropertyAccess(access, String(conversation.property_id))) {
    throw new Error("permission_denied");
  }
  const result = await hydrateHospitableReservationMessageHistory({
    workspaceId: (await resolveHospitableMessagingWorkspace({
      workspaceId: access.workspaceId,
      propertyId: String(conversation.property_id),
    })).workspaceId,
    reservationId,
    requestId: crypto.randomUUID(),
    force: formData.get("force") === "true",
  });
  revalidatePath("/dashboard/communications");
  revalidatePath(`/dashboard/communications/${conversationId}`);
  return result;
}

export async function addGuestCommunicationNote(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!conversationId || !body || body.length > 5_000) return;
  const admin = createAdminClient();
  const { data: candidate } = await admin.from("guest_conversations").select("*").eq("id", conversationId).maybeSingle();
  if (!candidate) throw new Error("conversation_not_found");
  const row = candidate as ConversationRow;
  const { user, access } = await authorizeLegacyCommunicationWorkspace(row.workspace_id, "communications.reply");
  if (!evaluatePropertyAccess(access, row.property_id)) throw new Error("permission_denied");
  const createdAt = new Date().toISOString();
  const noteId = `guest-note-${crypto.randomUUID()}`;
  const { error } = await admin.from("guest_communication_notes").insert({ id: noteId, conversation_id: conversationId, body, pinned: formData.get("pinned") === "on", author_profile_id: user.id, created_at: createdAt });
  if (error) throw error;
  await admin.from("guest_communication_timeline").insert({ id: `guest-timeline-${crypto.randomUUID()}`, conversation_id: conversationId, event_type: "internal-note", visibility: "internal", note_id: noteId, safe_summary: "Private internal note added.", occurred_at: createdAt });
  await admin.from("guest_conversation_activity").insert({id:`activity-${crypto.randomUUID()}`,conversation_id:conversationId,workspace_id:row.workspace_id,actor_profile_id:user.id,event_type:"internal-note-added",safe_summary:"Private internal note appended to the relationship history.",metadata:{noteId},occurred_at:createdAt});
  revalidatePath(`/dashboard/communications/${conversationId}`);
}

export async function addGuestCommunicationLinkAttachmentAction(formData:FormData){
  const conversationId=String(formData.get("conversationId")??""),name=String(formData.get("name")??"").trim(),url=String(formData.get("url")??"").trim();
  let parsed:URL;try{parsed=new URL(url);}catch{throw new Error("attachment_invalid");}
  if(!conversationId||!name||name.length>200||parsed.protocol!=="https:")throw new Error("attachment_invalid");
  const admin=createAdminClient(),{data:candidate}=await admin.from("guest_conversations").select("*").eq("id",conversationId).maybeSingle();
  if(!candidate)throw new Error("conversation_not_found");
  const row=candidate as ConversationRow,{user,access}=await authorizeLegacyCommunicationWorkspace(row.workspace_id,"communications.reply");
  if(!evaluatePropertyAccess(access,row.property_id))throw new Error("permission_denied");
  const createdAt=new Date().toISOString(),attachmentId=`guest-attachment-${crypto.randomUUID()}`;
  await Promise.all([
    admin.from("guest_communication_attachments").insert({id:attachmentId,conversation_id:conversationId,attachment_type:"link",name,url:parsed.toString(),created_at:createdAt}),
    admin.from("guest_communication_timeline").insert({id:`guest-timeline-${crypto.randomUUID()}`,conversation_id:conversationId,event_type:"attachment",visibility:"internal",safe_summary:"Operator attached a reviewed secure link.",metadata:{attachmentId,actorProfileId:user.id},occurred_at:createdAt}),
    admin.from("guest_conversation_activity").insert({id:`activity-${crypto.randomUUID()}`,conversation_id:conversationId,workspace_id:row.workspace_id,actor_profile_id:user.id,event_type:"attachment-added",safe_summary:"Attachment added independently of message delivery.",metadata:{attachmentId},occurred_at:createdAt}),
  ]);
  revalidatePath(`/dashboard/communications/${conversationId}`);
}

export async function changeGuestConversationStatusAction(formData:FormData){
  const conversationId=String(formData.get("conversationId")??""),operation=String(formData.get("operation")??"");
  if(!["close","reopen","archive"].includes(operation))throw new Error("conversation_status_invalid");
  const admin=createAdminClient(),{data:candidate}=await admin.from("guest_conversations").select("*").eq("id",conversationId).maybeSingle();
  if(!candidate)throw new Error("conversation_not_found");
  const row=candidate as ConversationRow,{user,access}=await authorizeLegacyCommunicationWorkspace(row.workspace_id,"communications.reply");
  if(!evaluatePropertyAccess(access,row.property_id))throw new Error("permission_denied");
  const status=operation==="close"?"resolved":operation==="archive"?"archived":"open",waitingOn="none",occurredAt=new Date().toISOString();
  const{error}=await admin.from("guest_conversations").update({status,waiting_on:waitingOn,updated_at:occurredAt,revision:row.revision+1}).eq("id",conversationId).eq("revision",row.revision);
  if(error)throw new Error("concurrency_conflict");
  await admin.from("guest_communication_timeline").insert({id:`guest-timeline-${crypto.randomUUID()}`,conversation_id:conversationId,event_type:"status-changed",visibility:"internal",safe_summary:operation==="archive"?"Conversation archived without deleting history.":operation==="close"?"Conversation closed by an operator.":"Conversation reopened for operator follow-up.",metadata:{operation,actorProfileId:user.id},occurred_at:occurredAt});
  await admin.from("guest_conversation_activity").insert({id:`activity-${crypto.randomUUID()}`,conversation_id:conversationId,workspace_id:row.workspace_id,actor_profile_id:user.id,event_type:operation==="archive"?"conversation-archived":operation==="close"?"conversation-resolved":"conversation-reopened",safe_summary:operation==="archive"?"Conversation archived without deleting relationship history.":operation==="close"?"Conversation resolved by an operator.":"Conversation reopened for follow-up.",metadata:{operation},occurred_at:occurredAt});
  revalidatePath(`/dashboard/communications/${conversationId}`);revalidatePath("/dashboard/communications");
}

export async function completeCommunicationRecommendationAction(formData:FormData){await changeRecommendationDisposition(formData,"completed");}
export async function dismissCommunicationRecommendationAction(formData:FormData){await changeRecommendationDisposition(formData,"dismissed");}
async function changeRecommendationDisposition(formData:FormData,status:"completed"|"dismissed"){
  const conversationId=String(formData.get("conversationId")??""),actionKey=String(formData.get("actionKey")??""),contextFingerprint=String(formData.get("contextFingerprint")??""),reason=String(formData.get("reason")??"").trim();
  if(!conversationId||!actionKey||!contextFingerprint||(status==="dismissed"&&!reason)||reason.length>500)throw new Error("recommendation_disposition_invalid");
  const admin=createAdminClient(),{data:conversation}=await admin.from("guest_conversations").select("*").eq("id",conversationId).maybeSingle();
  if(!conversation)throw new Error("conversation_not_found");
  const{user,access}=await authorize(String(conversation.workspace_id),"communications.reply");if(!evaluatePropertyAccess(access,String(conversation.property_id)))throw new Error("permission_denied");
  const occurredAt=new Date().toISOString(),{data:recommendation,error}=await admin.from("guest_communication_recommendations").update({status,acted_by:user.id,...(status==="completed"?{completed_at:occurredAt}:{dismissed_at:occurredAt,dismissal_reason:reason})}).eq("conversation_id",conversationId).eq("action_key",actionKey).eq("context_fingerprint",contextFingerprint).eq("status","active").select("id").maybeSingle();
  if(error||!recommendation)throw new Error("recommendation_changed");
  await Promise.all([
    admin.from("guest_communication_guidance_activity").insert({conversation_id:conversationId,workspace_id:conversation.workspace_id,recommendation_id:recommendation.id,actor_profile_id:user.id,event_type:status==="completed"?"recommendation-completed":"recommendation-dismissed",safe_summary:status==="completed"?"Operator marked a communication recommendation complete.":"Operator dismissed a communication recommendation with a recorded reason.",metadata:{actionKey,...(reason?{reason}:{})},occurred_at:occurredAt}),
    admin.from("guest_communication_timeline").insert({id:`guest-timeline-${crypto.randomUUID()}`,conversation_id:conversationId,event_type:"status-changed",visibility:"internal",safe_summary:status==="completed"?"Communication recommendation completed.":"Communication recommendation dismissed by an operator.",metadata:{actionKey,status},occurred_at:occurredAt}),
  ]);
  revalidatePath(`/dashboard/communications/${conversationId}`);
}

export async function createCommunicationTemplateVersionAction(formData:FormData){
  const workspaceId=String(formData.get("workspaceId")??""),seriesKey=String(formData.get("seriesKey")??"").trim(),category=String(formData.get("category")??"").trim(),title=String(formData.get("title")??"").trim(),body=String(formData.get("body")??"").trim(),language=String(formData.get("language")??"en").trim(),locale=String(formData.get("locale")??"en-US").trim(),subject=String(formData.get("subject")??"").trim(),variables=[...new Set(String(formData.get("variables")??"").split(",").map(item=>item.trim()).filter(Boolean))];
  if(!seriesKey||!category||!title||!body||body.length>10_000)throw new Error("communication_template_invalid");
  const{access}=await authorize(workspaceId,"communications.manage"),admin=createAdminClient(),{data:prior}=await admin.from("guest_communication_templates").select("version").eq("workspace_id",access.workspaceId).eq("series_key",seriesKey).order("version",{ascending:false}).limit(1).maybeSingle(),version=Number(prior?.version??0)+1;
  const placeholders=[...body.matchAll(/\{\{(\w+)\}\}/g)].map(match=>match[1]);if(placeholders.some(variable=>!variables.includes(variable)))throw new Error("communication_template_variables_invalid");
  const{error}=await admin.from("guest_communication_templates").insert({id:`communication-template-${crypto.randomUUID()}`,workspace_id:access.workspaceId,series_key:seriesKey,version,category,title,subject:subject||null,body,variables,language,locale,status:"inactive",publication_status:"draft",delivery_mode:"immediate"});
  if(error)throw new Error("communication_template_version_conflict");
  revalidatePath("/dashboard/communications");
}
export async function publishCommunicationTemplateAction(formData:FormData){await changeCommunicationTemplateLifecycle(formData,"published");}
export async function archiveCommunicationTemplateAction(formData:FormData){await changeCommunicationTemplateLifecycle(formData,"archived");}
async function changeCommunicationTemplateLifecycle(formData:FormData,target:"published"|"archived"){
  const templateId=String(formData.get("templateId")??""),admin=createAdminClient(),{data:template}=await admin.from("guest_communication_templates").select("*").eq("id",templateId).maybeSingle();
  if(!template?.workspace_id)throw new Error("communication_template_unavailable");
  const{user,access}=await authorize(String(template.workspace_id),"communications.manage");
  if(access.workspaceId!==template.workspace_id)throw new Error("permission_denied");
  if(target==="published"&&template.publication_status!=="draft")throw new Error("communication_template_transition_invalid");
  if(target==="archived"&&template.publication_status==="archived")return;
  const occurredAt=new Date().toISOString(),{error}=await admin.from("guest_communication_templates").update({publication_status:target,status:target==="published"?"active":"archived",...(target==="published"?{published_at:occurredAt,published_by:user.id}:{})}).eq("id",templateId);
  if(error)throw new Error("communication_template_transition_failed");
  await admin.from("guest_communication_guidance_activity").insert({workspace_id:template.workspace_id,template_id:templateId,actor_profile_id:user.id,event_type:target==="published"?"template-published":"template-archived",safe_summary:target==="published"?"Communication template version published and made immutable.":"Communication template version archived without deleting history.",metadata:{seriesKey:template.series_key,version:template.version},occurred_at:occurredAt});
  revalidatePath("/dashboard/communications");
}

async function deliverQueuedMessage(input:{admin:ReturnType<typeof createAdminClient>;row:ConversationRow;messageId:string;body:string}):Promise<GuestCommunicationComposerState>{
  const{admin,row,messageId,body}=input,startedAt=new Date().toISOString();
  const[{data:booking},{data:thread},{count}]=await Promise.all([
    admin.from("bookings").select("external_reservation_id").eq("id",row.booking_id).maybeSingle(),
    admin.from("guest_conversation_provider_threads").select("provider,thread_id,reservation_reference").eq("conversation_id",row.id).order("last_observed_at",{ascending:false}).limit(1).maybeSingle(),
    admin.from("guest_communication_delivery_attempts").select("id",{count:"exact",head:true}).eq("message_id",messageId),
  ]);
  const providerName=String(thread?.provider??"internal"),{data:connection}=await admin.from("integration_connections").select("id,status").eq("workspace_id",row.workspace_id).eq("provider",providerName).maybeSingle();
  const attemptId=`guest-delivery-${crypto.randomUUID()}`,attempt=(count??0)+1;
  await admin.from("guest_communication_messages").update({delivery_status:"sending"}).eq("id",messageId).eq("delivery_status","queued");
  await Promise.all([
    admin.from("guest_communication_delivery_attempts").insert({id:attemptId,conversation_id:row.id,message_id:messageId,attempt,provider:providerName,status:"sending",started_at:startedAt}),
    admin.from("guest_message_delivery_events").insert({id:`delivery-event-${crypto.randomUUID()}`,conversation_id:row.id,message_id:messageId,provider:providerName,status:"sending",occurred_at:startedAt}),
  ]);
  try{
    if(connection?.status!=="active")throw Object.assign(new Error(connection?.status==="authorization-expired"?"provider_unauthorized":"provider_not_connected"),{status:connection?.status==="authorization-expired"?401:503});
    const adapter=DEFAULT_MESSAGING_PROVIDER_REGISTRY.require(providerName);
    if(!adapter.capabilities.includes("send-messages"))throw new Error("unsupported-capability");
    const reservationId=String(thread?.reservation_reference??booking?.external_reservation_id??"");
    if(!reservationId&&!thread?.thread_id)throw new Error("thread-unresolved");
    const sent=await adapter.sendMessage({commandId:`send:${messageId}`,workspaceId:row.workspace_id,conversationId:row.id,messageId,threadId:String(thread?.thread_id??reservationId),...(reservationId?{reservationReference:reservationId}:{}),body,attachments:[]}),completedAt=new Date().toISOString(),canonicalStatus=sent.deliveryState==="queued"?"sent":sent.deliveryState;
    await Promise.all([
      admin.from("guest_communication_messages").update({delivery_status:canonicalStatus,provider_message_id:sent.providerMessageId,...(canonicalStatus==="delivered"?{delivered_at:completedAt}:{})}).eq("id",messageId).eq("delivery_status","sending"),
      admin.from("guest_communication_delivery_attempts").update({status:canonicalStatus,completed_at:completedAt}).eq("id",attemptId),
      admin.from("guest_message_delivery_events").insert({id:`delivery-event-${crypto.randomUUID()}`,conversation_id:row.id,message_id:messageId,provider:providerName,status:sent.deliveryState,provider_message_id:sent.providerMessageId,occurred_at:completedAt}),
      admin.from("guest_conversation_activity").insert({id:`activity-${crypto.randomUUID()}`,conversation_id:row.id,workspace_id:row.workspace_id,event_type:"delivery-updated",safe_summary:sent.deliveryState==="delivered"?"Provider confirmed delivery.":"Provider accepted the reply; final delivery is not yet confirmed.",metadata:{messageId,status:sent.deliveryState,adapterVersion:adapter.version},occurred_at:completedAt}),
      admin.from("guest_communication_timeline").insert({id:`guest-timeline-${crypto.randomUUID()}`,conversation_id:row.id,event_type:"status-changed",visibility:"internal",message_id:messageId,safe_summary:sent.deliveryState==="delivered"?"Reply delivered by the configured provider.":"Reply accepted by the configured provider.",metadata:{deliveryStatus:sent.deliveryState},occurred_at:completedAt}),
      admin.from("messaging_provider_activity").insert({workspace_id:row.workspace_id,connection_id:connection.id,provider:providerName,event_type:"message-sent",safe_summary:"Canonical message accepted by the configured provider adapter.",metadata:{messageId,deliveryState:sent.deliveryState,adapterVersion:adapter.version},occurred_at:completedAt}),
    ]);
    return{ok:true,message:sent.deliveryState==="delivered"?"Reply delivered.":"Reply sent to the provider.",messageId};
  }catch(error){
    const failure=providerFailure(error),retryable=failure.retryable,failureCode=failure.code,completedAt=new Date().toISOString();
    await Promise.all([
      admin.from("guest_communication_messages").update({delivery_status:"failed",failure_code:failureCode}).eq("id",messageId).eq("delivery_status","sending"),
      admin.from("guest_communication_delivery_attempts").update({status:"failed",failure_code:failureCode,retryable,completed_at:completedAt}).eq("id",attemptId),
      admin.from("guest_message_delivery_events").insert({id:`delivery-event-${crypto.randomUUID()}`,conversation_id:row.id,message_id:messageId,provider:providerName,status:"failed",failure_code:failureCode,retryable,occurred_at:completedAt}),
      admin.from("guest_conversation_activity").insert({id:`activity-${crypto.randomUUID()}`,conversation_id:row.id,workspace_id:row.workspace_id,event_type:"delivery-updated",safe_summary:"Provider delivery failed without changing message content.",metadata:{messageId,failureCode,retryable},occurred_at:completedAt}),
      admin.from("guest_communication_timeline").insert({id:`guest-timeline-${crypto.randomUUID()}`,conversation_id:row.id,event_type:"status-changed",visibility:"internal",message_id:messageId,safe_summary:"Provider delivery failed safely. The reply remains available for review and retry.",metadata:{deliveryStatus:"failed",failureCode,retryable},occurred_at:completedAt}),
    ]);
    return{ok:false,message:`${failure.message} ${failure.impact} ${failure.recovery}`,messageId};
  }
}

async function persistCommunicationGuidance(input:{admin:ReturnType<typeof createAdminClient>;workspaceId:string;conversationId:string;guidance:ReturnType<typeof evaluateCommunicationGuidance>;existing:Record<string,unknown>[]}){
  const existingKeys=new Set(input.existing.map(item=>`${item.action_key}:${item.context_fingerprint}`)),activeKeys=new Set(input.guidance.map(item=>`${item.actionKey}:${item.contextFingerprint}`));
  const stale=input.existing.filter(item=>item.status==="active"&&!activeKeys.has(`${item.action_key}:${item.context_fingerprint}`)).map(item=>String(item.id));
  if(stale.length)await input.admin.from("guest_communication_recommendations").update({status:"superseded"}).in("id",stale).eq("status","active");
  for(const item of input.guidance){
    const key=`${item.actionKey}:${item.contextFingerprint}`;if(existingKeys.has(key))continue;
    const{data:created}=await input.admin.from("guest_communication_recommendations").insert({conversation_id:input.conversationId,workspace_id:input.workspaceId,rule_id:item.ruleId,action_key:item.actionKey,context_fingerprint:item.contextFingerprint,priority:item.priority,confidence:item.confidence,title:item.title,reason:item.reason,explanation:item.explanation,suggested_template_category:item.suggestedTemplateCategory??null,dependencies:item.dependencies,status:"active"}).select("id").maybeSingle();
    if(created)await input.admin.from("guest_communication_guidance_activity").insert({conversation_id:input.conversationId,workspace_id:input.workspaceId,recommendation_id:created.id,event_type:"recommendation-created",safe_summary:"Deterministic communication guidance created from canonical guest context.",metadata:{actionKey:item.actionKey,ruleId:item.ruleId,priority:item.priority},occurred_at:new Date().toISOString()});
  }
}
function selectLocalizedTemplates(rows:Record<string,unknown>[],language:string,workspaceId:string){
  const selected=new Map<string,Record<string,unknown>>();
  for(const row of rows){const category=String(row.category),prior=selected.get(category),score=(row.workspace_id===workspaceId?100:0)+(String(row.language??"en")===language?10:String(row.language??"en")==="en"?1:0)+Number(row.version??1)/1000,priorScore=prior?(prior.workspace_id===workspaceId?100:0)+(String(prior.language??"en")===language?10:String(prior.language??"en")==="en"?1:0)+Number(prior.version??1)/1000:-1;if(score>priorScore)selected.set(category,row);}
  return[...selected.values()].map(template=>({id:String(template.id),category:String(template.category),title:String(template.title),body:String(template.body),variables:(Array.isArray(template.variables)?template.variables:[]).map(String),status:"active"as const}))as import("@/features/guest-communications").CommunicationTemplate[];
}

function mapConversationAggregate(row:ConversationRow,related:{messages:Record<string,unknown>[];notes:Record<string,unknown>[];attachments:Record<string,unknown>[];participants:Record<string,unknown>[];reservationLinks:Record<string,unknown>[];providerThreads:Record<string,unknown>[];deliveryEvents:Record<string,unknown>[];activity:Record<string,unknown>[]}){
  const attachments=related.attachments.map(item=>Object.freeze({id:String(item.id),type:String(item.attachment_type)as CommunicationAttachment["type"],name:String(item.name),...(item.url?{url:String(item.url)}:{}),...(item.storage_path?{storagePath:String(item.storage_path)}:{})}));
  const messages:CanonicalMessage[]=related.messages.map(item=>Object.freeze({id:String(item.id),conversationId:row.id,sender:Object.freeze({type:(item.direction==="inbound"?"guest":item.direction==="system-event"?"system":item.direction==="unknown"?"unknown":"operator")as CanonicalMessage["sender"]["type"],...(item.sender_profile_id?{id:String(item.sender_profile_id)}:{}),displayName:String(item.sender_display_name)}),recipient:Object.freeze({type:String(item.recipient_type??(item.sender_type==="guest"?"operator":"guest"))as CanonicalMessage["recipient"]["type"],...(item.recipient_id?{id:String(item.recipient_id)}:{}),displayName:String(item.recipient_display_name??"Recipient")}),channel:String(item.message_channel??"internal"),direction:String(item.direction??(item.sender_type==="guest"?"inbound":"outbound"))as CanonicalMessage["direction"],body:String(item.body),sentAt:String(item.provider_occurred_at??item.created_at),attachments:Object.freeze(attachments.filter(attachment=>related.attachments.find(candidate=>String(candidate.id)===attachment.id)?.message_id===item.id)),...(item.template_id?{templateId:String(item.template_id)}:{})}));
  const notes:InternalCommunicationNote[]=related.notes.map(item=>Object.freeze({id:String(item.id),conversationId:row.id,body:String(item.body),pinned:Boolean(item.pinned),authorProfileId:String(item.author_profile_id),createdAt:String(item.created_at)}));
  const deliveryEvents:DeliveryEvent[]=related.deliveryEvents.map(item=>Object.freeze({id:String(item.id),messageId:String(item.message_id),provider:String(item.provider),status:String(item.status)as DeliveryEvent["status"],occurredAt:String(item.occurred_at),...(item.provider_message_id?{providerMessageId:String(item.provider_message_id)}:{}),...(item.failure_code?{failureCode:String(item.failure_code)}:{}),...(item.retryable!==null&&item.retryable!==undefined?{retryable:Boolean(item.retryable)}:{})}));
  return createConversationAggregate({id:row.id,workspaceId:row.workspace_id,guestId:row.guest_id,propertyId:row.property_id,...(row.active_reservation_id?{activeReservationId:row.active_reservation_id}:{}),status:(row.status==="waiting-on-host"||row.status==="needs-reply"||row.status==="unread"?"waiting-on-operator":row.status)as import("@/features/guest-communications").CanonicalConversationStatus,waitingOn:(row.waiting_on??(row.status==="waiting-on-guest"?"guest":row.status==="waiting-on-operator"?"operator":"none"))as"guest"|"operator"|"none",priority:(row.priority??"normal")as import("@/features/guest-communications").ConversationPriority,participants:Object.freeze(related.participants.map(item=>Object.freeze({id:String(item.id),type:String(item.participant_type)as ConversationParticipant["type"],displayName:String(item.display_name),...(item.guest_id?{guestId:String(item.guest_id)}:{}),...(item.profile_id?{profileId:String(item.profile_id)}:{}),joinedAt:String(item.joined_at)}))),reservationLinks:Object.freeze(related.reservationLinks.map(item=>Object.freeze({reservationId:String(item.reservation_id),bookingId:String(item.booking_id),propertyId:String(item.property_id),active:Boolean(item.active),linkedAt:String(item.linked_at)}as ConversationReservationLink))),providerThreads:Object.freeze(related.providerThreads.map(item=>Object.freeze({provider:String(item.provider),threadId:String(item.thread_id),...(item.reservation_reference?{reservationReference:String(item.reservation_reference)}:{}),lastObservedAt:String(item.last_observed_at)}as ProviderThreadReference))),messages:Object.freeze(messages),notes:Object.freeze(notes),attachments:Object.freeze(attachments),deliveryEvents:Object.freeze(deliveryEvents),activity:Object.freeze(related.activity.map(item=>Object.freeze({id:String(item.id),type:String(item.event_type)as ConversationActivity["type"],summary:String(item.safe_summary),occurredAt:String(item.occurred_at),...(item.actor_profile_id?{actorId:String(item.actor_profile_id)}:{})}))),unreadCount:row.unread_count,createdAt:String(row.created_at??row.last_activity_at),updatedAt:String(row.updated_at??row.last_activity_at),lastActivityAt:row.last_activity_at,revision:row.revision});
}

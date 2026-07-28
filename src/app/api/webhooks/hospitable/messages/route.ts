import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveHospitableMessagingWorkspace } from "@/features/integrations/hospitable/lib/messaging-workspace";

type Payload=Record<string,unknown>;
export async function POST(request:Request){
  const secret=process.env.HOSPITABLE_WEBHOOK_SECRET,rawBody=await request.text();
  if(!secret||!authenticated(request,rawBody,secret))return NextResponse.json({accepted:false,code:"webhook_unauthorized"},{status:401});
  let envelope:Payload;try{envelope=JSON.parse(rawBody)as Payload;}catch{return NextResponse.json({accepted:false,code:"webhook_invalid"},{status:400});}
  const data=(envelope.data&&typeof envelope.data==="object"?envelope.data:envelope)as Payload;
  const providerMessageId=text(data,"id")||text(data,"message_id"),reservationId=text(data,"reservation_id")||text(data,"reservation_uuid"),threadId=text(data,"conversation_id")||text(data,"thread_id")||reservationId,body=text(data,"body")||text(data,"message"),attachments=Array.isArray(data.attachments)?data.attachments:[],occurredAt=text(data,"created_at")||new Date().toISOString();
  if(!providerMessageId||!reservationId||!threadId||(!body&&attachments.length===0))return NextResponse.json({accepted:false,code:"webhook_context_incomplete"},{status:202});
  const admin=createAdminClient(),[{data:booking},{data:connection}]=await Promise.all([admin.from("bookings").select("id,property_id,primary_guest_id,guest_full_name").eq("external_provider","hospitable").eq("external_reservation_id",reservationId).maybeSingle(),admin.from("integration_connections").select("id,workspace_id").eq("provider","hospitable").order("updated_at",{ascending:false}).limit(1).maybeSingle()]);
  if(!booking||!booking.primary_guest_id){await admin.from("messaging_provider_review_queue").upsert({workspace_id:connection?.workspace_id??null,connection_id:connection?.id??null,provider:"hospitable",provider_event_id:providerMessageId,reason:"unknown-reservation",status:"pending",provider_thread_reference:threadId,reservation_reference:reservationId,pending_message_body:body,occurred_at:occurredAt},{onConflict:"provider,provider_event_id",ignoreDuplicates:true});await admin.from("messaging_provider_activity").insert({workspace_id:connection?.workspace_id??null,connection_id:connection?.id??null,provider:"hospitable",event_type:"thread-resolution-failed",safe_summary:"Inbound provider message requires manual reservation association.",metadata:{providerEventId:providerMessageId},occurred_at:occurredAt});return NextResponse.json({accepted:false,code:"reservation_unresolved",reviewRequired:true},{status:202});}
  if(!connection)return NextResponse.json({accepted:false,code:"workspace_unresolved"},{status:202});
  let workspaceId:string;
  try{workspaceId=(await resolveHospitableMessagingWorkspace({connectionId:String(connection.id),propertyId:String(booking.property_id)})).workspaceId;}
  catch{return NextResponse.json({accepted:false,code:"workspace_unresolved"},{status:202});}
  const{data:links,error:linkError}=await admin.from("guest_conversation_reservations").select("conversation_id").eq("booking_id",booking.id).eq("reservation_id",reservationId);
  if(linkError||(links??[]).length!==1)return NextResponse.json({accepted:false,code:(links??[]).length>1?"conversation_ambiguous":"conversation_unresolved",reviewRequired:true},{status:202});
  const{error}=await admin.rpc("ingest_guest_provider_message",{p_workspace_id:workspaceId,p_property_id:booking.property_id,p_booking_id:booking.id,p_conversation_id:links![0].conversation_id,p_provider:"hospitable",p_provider_message_id:providerMessageId,p_platform_message_id:data.platform_id?String(data.platform_id):null,p_provider_reservation_id:reservationId,p_provider_conversation_id:threadId,p_sender_type:"guest",p_sender_display_name:booking.guest_full_name??"Guest",p_body:body,p_content_type:text(data,"content_type")||"text/plain",p_message_channel:text(data,"platform")||"hospitable",p_direction:"inbound",p_delivery_status:"delivered",p_occurred_at:occurredAt,p_ingested_at:new Date().toISOString(),p_attachments:attachments,p_metadata:{eventType:text(envelope,"event")||text(envelope,"type")||"unknown"},p_provenance:{provider:"hospitable",source:"webhook"},p_backfill:false});
  if(error){console.error("guest_message_webhook_failed",{provider:"hospitable",errorType:error.code??"storage"});return NextResponse.json({accepted:false,code:"message_ingestion_failed"},{status:503});}
  return NextResponse.json({accepted:true});
}
function text(value:Payload,key:string){return typeof value[key]==="string"?String(value[key]).trim():"";}
function safeEqual(first:string,second:string){const a=Buffer.from(first),b=Buffer.from(second);return a.length===b.length&&timingSafeEqual(a,b);}
function authenticated(request:Request,rawBody:string,secret:string){
 const authorization=request.headers.get("authorization")??"";if(safeEqual(authorization,`Bearer ${secret}`))return true;
 const timestamp=request.headers.get("x-luxe-webhook-timestamp")??"",signature=(request.headers.get("x-luxe-webhook-signature")??"").replace(/^sha256=/,"");
 const time=Number(timestamp);if(!Number.isFinite(time)||Math.abs(Date.now()-time*1000)>300_000)return false;
 return safeEqual(signature,createHmac("sha256",secret).update(`${timestamp}.${rawBody}`).digest("hex"));
}

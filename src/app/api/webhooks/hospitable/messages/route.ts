import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Payload=Record<string,unknown>;
export async function POST(request:Request){
  const secret=process.env.HOSPITABLE_WEBHOOK_SECRET,rawBody=await request.text();
  if(!secret||!authenticated(request,rawBody,secret))return NextResponse.json({accepted:false,code:"webhook_unauthorized"},{status:401});
  let envelope:Payload;try{envelope=JSON.parse(rawBody)as Payload;}catch{return NextResponse.json({accepted:false,code:"webhook_invalid"},{status:400});}
  const data=(envelope.data&&typeof envelope.data==="object"?envelope.data:envelope)as Payload;
  const providerMessageId=text(data,"id")||text(data,"message_id"),reservationId=text(data,"reservation_id")||text(data,"reservation_uuid"),threadId=text(data,"conversation_id")||text(data,"thread_id")||reservationId,body=text(data,"body")||text(data,"message"),occurredAt=text(data,"created_at")||new Date().toISOString();
  if(!providerMessageId||!reservationId||!threadId||!body)return NextResponse.json({accepted:false,code:"webhook_context_incomplete"},{status:202});
  const admin=createAdminClient(),[{data:booking},{data:connection}]=await Promise.all([admin.from("bookings").select("id,property_id,primary_guest_id,guest_full_name,properties!inner(owner:owners!inner(profile_id))").eq("external_provider","hospitable").eq("external_reservation_id",reservationId).maybeSingle(),admin.from("integration_connections").select("id,workspace_id").eq("provider","hospitable").order("updated_at",{ascending:false}).limit(1).maybeSingle()]);
  if(!booking||!booking.primary_guest_id){await admin.from("messaging_provider_review_queue").upsert({workspace_id:connection?.workspace_id??null,connection_id:connection?.id??null,provider:"hospitable",provider_event_id:providerMessageId,reason:"unknown-reservation",status:"pending",provider_thread_reference:threadId,reservation_reference:reservationId,pending_message_body:body,occurred_at:occurredAt},{onConflict:"provider,provider_event_id",ignoreDuplicates:true});await admin.from("messaging_provider_activity").insert({workspace_id:connection?.workspace_id??null,connection_id:connection?.id??null,provider:"hospitable",event_type:"thread-resolution-failed",safe_summary:"Inbound provider message requires manual reservation association.",metadata:{providerEventId:providerMessageId},occurred_at:occurredAt});return NextResponse.json({accepted:false,code:"reservation_unresolved",reviewRequired:true},{status:202});}
  const property=Array.isArray(booking.properties)?booking.properties[0]:booking.properties,ownerRelation=property?.owner,owner=Array.isArray(ownerRelation)?ownerRelation[0]:ownerRelation,workspaceId=owner?.profile_id;
  if(!workspaceId)return NextResponse.json({accepted:false,code:"workspace_unresolved"},{status:202});
  const messageId=`guest-message-provider-${providerMessageId}`,{error}=await admin.rpc("append_guest_inbound_message",{p_workspace_id:workspaceId,p_message_id:messageId,p_provider:"hospitable",p_provider_message_id:providerMessageId,p_provider_thread_id:threadId,p_reservation_id:reservationId,p_booking_id:booking.id,p_guest_id:booking.primary_guest_id,p_property_id:booking.property_id,p_guest_name:booking.guest_full_name??"Guest",p_body:body,p_occurred_at:occurredAt});
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

import{deriveProviderHealth}from"../../application/provider-health";
import type{MessagingProviderAdapter,ProviderMessageCommand,ProviderSyncCommand}from"../../domain/messaging-provider";
import{runHospitableReservationSync}from"./run-reservation-sync";
import{sendHospitableReservationMessage}from"./messages";

export const hospitableMessagingAdapter:MessagingProviderAdapter=Object.freeze({
 id:"hospitable",name:"Hospitable",version:"hospitable-messaging-v1",channels:Object.freeze(["platform-messaging"]),
 capabilities:Object.freeze(["send-messages","receive-messages","reservations","read-receipts","templates"]as const),
 configuration(){return Object.freeze({configured:Boolean(process.env.HOSPITABLE_API_TOKEN),authentication:process.env.HOSPITABLE_API_TOKEN?"configured"as const:"missing"as const,requiredEnvironment:Object.freeze(["HOSPITABLE_API_TOKEN","HOSPITABLE_WEBHOOK_SECRET"])});},
 async sendMessage(command:ProviderMessageCommand){
  if(!command.reservationReference&&!command.threadId)throw new Error("thread-unresolved");
  if(command.attachments.length)throw new Error("unsupported-capability");
  const result=await sendHospitableReservationMessage({reservationId:command.reservationReference??command.threadId,body:command.body});
  return Object.freeze({providerMessageId:result.providerMessageId,deliveryState:result.status==="delivered"?"delivered"as const:"queued"as const,acceptedAt:new Date().toISOString()});
 },
 async receiveMessages(){return Object.freeze([]);},
 async synchronize(command:ProviderSyncCommand){
  const startedAt=new Date().toISOString(),result=await runHospitableReservationSync();
  return Object.freeze({processed:result.processed,created:result.created,updated:result.updated,failed:result.failed,startedAt,completedAt:new Date().toISOString(),...(command.cursor?{cursor:command.cursor}:{})});
 },
 async resolveThread(input:Parameters<MessagingProviderAdapter["resolveThread"]>[0]){if(!input.providerThreadId&&!input.reservationReference)throw new Error("thread-unresolved");return Object.freeze({...(input.providerThreadId?{providerThreadId:input.providerThreadId}:{}),...(input.reservationReference?{reservationReference:input.reservationReference}:{})});},
 async health(input:Parameters<MessagingProviderAdapter["health"]>[0]){return deriveProviderHealth(input);},
 async disconnect(){return;},
});

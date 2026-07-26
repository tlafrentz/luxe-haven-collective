import type { ReservationContext } from "@/features/reservation-context";
import type { CommunicationAttachment, CommunicationTemplate, InternalCommunicationNote } from "./guest-communications";
import type { GuestContextProjection } from "./guest-context-projection";
import type { CommunicationRecommendation } from "./communication-guidance";

export type CanonicalConversationStatus="open"|"waiting-on-guest"|"waiting-on-operator"|"resolved"|"archived";
export type ConversationPriority="low"|"normal"|"high"|"urgent";
export type ConversationParticipant=Readonly<{id:string;type:"guest"|"operator"|"system";displayName:string;guestId?:string;profileId?:string;joinedAt:string}>;
export type ConversationReservationLink=Readonly<{reservationId:string;bookingId:string;propertyId:string;active:boolean;linkedAt:string}>;
export type ProviderThreadReference=Readonly<{provider:string;threadId:string;reservationReference?:string;lastObservedAt:string}>;
export type CanonicalMessageDirection="inbound"|"outbound"|"internal-note"|"system-event";
export type CanonicalMessage=Readonly<{
  id:string;conversationId:string;sender:Readonly<{type:"guest"|"operator"|"system";id?:string;displayName:string}>;
  recipient:Readonly<{type:"guest"|"operator"|"system";id?:string;displayName:string}>;
  channel:string;direction:CanonicalMessageDirection;body:string;sentAt:string;
  attachments:readonly CommunicationAttachment[];templateId?:string;
}>;
export type DeliveryEvent=Readonly<{id:string;messageId:string;provider:string;status:"queued"|"sending"|"delivered"|"read"|"failed"|"unknown";occurredAt:string;providerMessageId?:string;failureCode?:string;retryable?:boolean}>;
export type ConversationActivity=Readonly<{id:string;type:"conversation-created"|"reply-sent"|"reply-received"|"draft-saved"|"attachment-added"|"template-applied"|"internal-note-added"|"conversation-resolved"|"conversation-archived"|"conversation-reopened"|"delivery-updated";summary:string;occurredAt:string;actorId?:string}>;
export type ConversationAggregate=Readonly<{
  id:string;workspaceId:string;guestId:string;propertyId:string;activeReservationId?:string;
  status:CanonicalConversationStatus;waitingOn:"guest"|"operator"|"none";priority:ConversationPriority;
  participants:readonly ConversationParticipant[];reservationLinks:readonly ConversationReservationLink[];
  providerThreads:readonly ProviderThreadReference[];messages:readonly CanonicalMessage[];
  notes:readonly InternalCommunicationNote[];attachments:readonly CommunicationAttachment[];
  deliveryEvents:readonly DeliveryEvent[];activity:readonly ConversationActivity[];
  unreadCount:number;createdAt:string;updatedAt:string;lastActivityAt:string;revision:number;
}>;
export type SuggestedConversationAction=Readonly<{key:string;label:string;reason:string;templateCategory?:string;href?:string}>;
export type ConversationProjection=Readonly<{
  projectionVersion:"guest-conversation-projection.v1";generatedAt:string;
  conversation:ConversationAggregate;guest:ReservationContext["guest"];reservation:ReservationContext;
  property:ReservationContext["property"];messages:readonly Readonly<CanonicalMessage&{delivery:DeliveryEvent["status"];deliveryHistory:readonly DeliveryEvent[]}>[];
  draft?:Readonly<{body:string;templateId?:string;updatedAt:string}>;attachments:readonly CommunicationAttachment[];
  notes:readonly InternalCommunicationNote[];timeline:readonly Readonly<{id:string;type:string;summary:string;occurredAt:string;visibility:"guest"|"internal"}>[];
  suggestedActions:readonly CommunicationRecommendation[];templates:readonly CommunicationTemplate[];
  guestContext:GuestContextProjection;
  providerState:Readonly<{connected:boolean;status:string;lastSynchronizedAt?:string;health?:string;adapterVersion?:string;capabilities?:readonly string[]}>;
  capabilities:Readonly<{view:boolean;reply:boolean;archive:boolean;note:boolean;template:boolean}>;
  state:"ready"|"partial"|"degraded"|"permission-limited";
}>;

export function createConversationAggregate(input:ConversationAggregate):ConversationAggregate{
  if(!input.id||!input.workspaceId||!input.guestId||!input.propertyId)throw new Error("conversation_context_required");
  if(!input.participants.some(item=>item.type==="guest"&&item.guestId===input.guestId))throw new Error("conversation_guest_participant_required");
  if(input.activeReservationId&&!input.reservationLinks.some(item=>item.reservationId===input.activeReservationId))throw new Error("conversation_active_reservation_invalid");
  return deepFreeze({...input,messages:ordered(input.messages,"sentAt"),deliveryEvents:ordered(input.deliveryEvents,"occurredAt"),activity:ordered(input.activity,"occurredAt")});
}
export function appendCanonicalMessage(aggregate:ConversationAggregate,message:CanonicalMessage,expectedRevision:number):ConversationAggregate{
  if(aggregate.revision!==expectedRevision)throw new Error("conversation_concurrency_conflict");
  if(message.conversationId!==aggregate.id)throw new Error("message_conversation_mismatch");
  if(aggregate.messages.some(item=>item.id===message.id))return aggregate;
  const inbound=message.direction==="inbound",status=inbound?"waiting-on-operator":message.direction==="outbound"?"waiting-on-guest":aggregate.status;
  return createConversationAggregate({...aggregate,messages:[...aggregate.messages,message],status,waitingOn:inbound?"operator":message.direction==="outbound"?"guest":aggregate.waitingOn,unreadCount:inbound?aggregate.unreadCount+1:aggregate.unreadCount,lastActivityAt:message.sentAt,updatedAt:message.sentAt,revision:aggregate.revision+1});
}
export function appendDeliveryEvent(aggregate:ConversationAggregate,event:DeliveryEvent):ConversationAggregate{
  if(!aggregate.messages.some(item=>item.id===event.messageId))throw new Error("delivery_message_not_found");
  if(aggregate.deliveryEvents.some(item=>item.id===event.id))return aggregate;
  return createConversationAggregate({...aggregate,deliveryEvents:[...aggregate.deliveryEvents,event],updatedAt:event.occurredAt,lastActivityAt:event.occurredAt,revision:aggregate.revision+1});
}
export function transitionConversation(aggregate:ConversationAggregate,status:CanonicalConversationStatus,occurredAt:string):ConversationAggregate{
  const allowed:Record<CanonicalConversationStatus,readonly CanonicalConversationStatus[]>={open:["waiting-on-guest","waiting-on-operator","resolved","archived"],"waiting-on-guest":["waiting-on-operator","resolved","archived"],"waiting-on-operator":["waiting-on-guest","resolved","archived"],resolved:["open","archived"],archived:["open"]};
  if(status!==aggregate.status&&!allowed[aggregate.status].includes(status))throw new Error("conversation_transition_invalid");
  return createConversationAggregate({...aggregate,status,waitingOn:status==="waiting-on-guest"?"guest":status==="waiting-on-operator"?"operator":"none",updatedAt:occurredAt,lastActivityAt:occurredAt,revision:aggregate.revision+1});
}
export function resolveConversationThread(input:Readonly<{conversationId?:string;provider?:string;providerThreadId?:string;reservationId?:string;guestId:string;propertyId:string}>,conversations:readonly ConversationAggregate[]){
  return(input.conversationId?conversations.find(item=>item.id===input.conversationId):undefined)
    ??(input.provider&&input.providerThreadId?conversations.find(item=>item.providerThreads.some(thread=>thread.provider===input.provider&&thread.threadId===input.providerThreadId)):undefined)
    ??(input.reservationId?conversations.find(item=>item.reservationLinks.some(link=>link.reservationId===input.reservationId)):undefined)
    ??conversations.find(item=>item.guestId===input.guestId&&item.propertyId===input.propertyId&&item.status!=="archived")
    ??null;
}
export function buildConversationProjection(input:Readonly<{conversation:ConversationAggregate;reservation:ReservationContext;guestContext:GuestContextProjection;guidance:readonly CommunicationRecommendation[];draft?:{body:string;templateId?:string;updatedAt:string};templates:readonly CommunicationTemplate[];providerState:ConversationProjection["providerState"];capabilities:ConversationProjection["capabilities"];generatedAt?:string}>):ConversationProjection{
  const latestDelivery=new Map<string,DeliveryEvent>(),histories=new Map<string,DeliveryEvent[]>();
  for(const event of input.conversation.deliveryEvents){histories.set(event.messageId,[...(histories.get(event.messageId)??[]),event]);latestDelivery.set(event.messageId,event);}
  const messages=input.conversation.messages.map(message=>Object.freeze({...message,delivery:latestDelivery.get(message.id)?.status??(message.direction==="inbound"?"delivered":"unknown"),deliveryHistory:Object.freeze(histories.get(message.id)??[])}));
  const timeline=[
    ...messages.map(message=>({id:message.id,type:message.direction,summary:message.body,occurredAt:message.sentAt,visibility:message.direction==="internal-note"?"internal"as const:"guest"as const})),
    ...input.conversation.activity.map(event=>({id:event.id,type:event.type,summary:event.summary,occurredAt:event.occurredAt,visibility:"internal"as const})),
  ].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt));
  return deepFreeze({projectionVersion:"guest-conversation-projection.v1",generatedAt:input.generatedAt??new Date().toISOString(),conversation:input.conversation,guest:input.reservation.guest,reservation:input.reservation,property:input.reservation.property,messages,...(input.draft?{draft:input.draft}:{}),attachments:input.conversation.attachments,notes:input.conversation.notes,timeline,suggestedActions:input.guidance,guestContext:input.guestContext,templates:input.templates,providerState:input.providerState,capabilities:input.capabilities,state:!input.capabilities.view?"permission-limited":input.guestContext.dataQuality.state==="stale"?"degraded":input.guestContext.dataQuality.state==="partially-available"?"partial":"ready"});
}
function ordered<T>(values:readonly T[],key:keyof T){return[...values].sort((a,b)=>Date.parse(String(a[key]))-Date.parse(String(b[key])));}
function deepFreeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;}

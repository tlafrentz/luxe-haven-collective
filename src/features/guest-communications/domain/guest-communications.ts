import type { ReservationContext } from "@/features/reservation-context";

export type ConversationStatus = "unread"|"needs-reply"|"waiting-on-guest"|"waiting-on-host"|"resolved"|"archived";
export type DeliveryStatus = "draft"|"queued"|"sent"|"delivered"|"failed"|"read"|"unknown";
export type CommunicationChannel = "hospitable"|"email"|"sms"|"airbnb"|"vrbo"|"internal";
export type MessageSender = Readonly<{type:"guest"|"operator"|"provider"|"system";profileId?:string;displayName:string}>;
export type CommunicationAttachment = Readonly<{id:string;type:"image"|"pdf"|"guidebook"|"link";name:string;url?:string;storagePath?:string}>;
export type GuestMessage = Readonly<{id:string;conversationId:string;sender:MessageSender;body:string;attachments:readonly CommunicationAttachment[];createdAt:string;deliveryStatus:DeliveryStatus;providerMessageId?:string;scheduledFor?:string}>;
export type InternalCommunicationNote = Readonly<{id:string;conversationId:string;body:string;pinned:boolean;authorProfileId:string;createdAt:string}>;
export type CommunicationTimelineEvent = Readonly<{id:string;conversationId:string;type:"message"|"template-used"|"guidebook-sent"|"internal-note"|"status-changed"|"action-created"|"attachment";occurredAt:string;visibility:"guest"|"internal";message?:GuestMessage;note?:InternalCommunicationNote;summary:string}>;
export type GuestConversation = Readonly<{id:string;workspaceId:string;reservationId:string;bookingId:string;guestId:string;propertyId:string;channel:CommunicationChannel;status:ConversationStatus;assignedToProfileId?:string;unreadCount:number;lastActivityAt:string;providerConversationId?:string;timeline:readonly CommunicationTimelineEvent[];revision:number}>;
export type CommunicationTemplate = Readonly<{id:string;category:"booking-confirmation"|"pre-arrival"|"check-in"|"parking"|"wifi"|"first-night"|"checkout-reminder"|"review-request"|"issue-acknowledgement"|"thank-you";title:string;body:string;variables:readonly TemplateVariable[];status:"active"|"inactive"|"archived"}>;
export type TemplateVariable = "guestName"|"propertyName"|"arrival"|"departure"|"guidebookLink"|"checkInTime"|"checkoutTime"|"wifi"|"hostName";
export type GuestCommunicationWorkspace = Readonly<{conversation:GuestConversation;reservation:ReservationContext;templates:readonly CommunicationTemplate[];guidebook?:Readonly<{available:boolean;publishedUrl?:string}>;suggestedReply?:Readonly<{body:string;qualification:"ai-draft";sources:readonly string[]}>;linkedActionIds:readonly string[];state:"ready"|"partial"|"degraded"|"permission-limited";evaluatedAt:string}>;

export class GuestCommunicationError extends Error{constructor(public readonly code:"conversation_not_found"|"reservation_not_found"|"permission_denied"|"delivery_failed"|"provider_unavailable"|"template_invalid"|"template_variable_missing"|"attachment_invalid"|"ai_context_invalid"|"concurrency_conflict"|"unexpected",message:string){super(message);Object.freeze(this);}}

export function createConversation(input:Omit<GuestConversation,"timeline"|"revision"> & {timeline?:readonly CommunicationTimelineEvent[];revision?:number}):GuestConversation{
 if(!input.workspaceId||!input.reservationId||!input.bookingId||!input.guestId||!input.propertyId)throw new GuestCommunicationError("reservation_not_found","Conversation requires Guest, Reservation, Booking, and Property context.");
 return deepFreeze({...input,timeline:[...(input.timeline??[])].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)),revision:input.revision??1});
}
export function appendTimelineEvent(conversation:GuestConversation,event:CommunicationTimelineEvent,expectedRevision:number):GuestConversation{
 if(conversation.revision!==expectedRevision)throw new GuestCommunicationError("concurrency_conflict","Conversation changed during review.");
 if(event.conversationId!==conversation.id||conversation.timeline.some(item=>item.id===event.id))return conversation;
 return createConversation({...conversation,timeline:[...conversation.timeline,event],lastActivityAt:event.occurredAt,revision:conversation.revision+1});
}
export function renderCommunicationTemplate(template:CommunicationTemplate,values:Partial<Record<TemplateVariable,string>>){
 const required=new Set(template.variables),missing=[...required].filter(key=>!values[key]?.trim());if(missing.length)throw new GuestCommunicationError("template_variable_missing",`Missing template variables: ${missing.join(", ")}.`);
 return template.body.replace(/\{\{(\w+)\}\}/g,(_,key:string)=>values[key as TemplateVariable]??"");
}
export function buildSuggestedReply(input:{conversation:GuestConversation;reservation:ReservationContext;guidebook?:{publishedUrl?:string};draft:string}){
 if(!input.draft.trim()||input.draft.length>5000)throw new GuestCommunicationError("ai_context_invalid","Suggested reply is invalid.");
 return Object.freeze({body:input.draft.trim(),qualification:"ai-draft"as const,sources:Object.freeze(["conversation",`reservation:${input.reservation.reservationId}`,`property:${input.reservation.property.id}`,...(input.guidebook?.publishedUrl?["published-guidebook"]:[])])});
}
function deepFreeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(deepFreeze);}return value;}

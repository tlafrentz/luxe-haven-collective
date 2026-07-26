export const MESSAGING_PROVIDER_CAPABILITIES=["send-messages","receive-messages","reservations","attachments","read-receipts","typing-indicators","templates","scheduling"]as const;
export type MessagingProviderCapability=typeof MESSAGING_PROVIDER_CAPABILITIES[number];
export type CanonicalDeliveryState="queued"|"sending"|"delivered"|"read"|"failed"|"unknown";
export type ProviderHealthState="connected"|"disconnected"|"degraded"|"maintenance"|"unauthorized"|"synchronization-stale";
export type ProviderFailureCode="provider-timeout"|"provider-unavailable"|"provider-rate-limited"|"provider-unauthorized"|"invalid-recipient"|"unsupported-capability"|"thread-unresolved"|"attachment-rejected"|"provider-conflict";
export type ProviderFailure=Readonly<{code:ProviderFailureCode;message:string;impact:string;recovery:string;retryable:boolean}>;
export type ProviderMessageCommand=Readonly<{commandId:string;workspaceId:string;conversationId:string;messageId:string;threadId:string;reservationReference?:string;body:string;attachments:readonly Readonly<{id:string;name:string;url?:string}>[]}>;
export type ProviderSendResult=Readonly<{providerMessageId:string;deliveryState:CanonicalDeliveryState;acceptedAt:string}>;
export type ProviderInboundMessage=Readonly<{providerMessageId:string;threadId:string;reservationReference?:string;guestReference?:string;propertyReference?:string;body:string;occurredAt:string}>;
export type ProviderSyncMode="manual"|"automatic"|"incremental"|"recovery";
export type ProviderSyncCommand=Readonly<{workspaceId:string;connectionId:string;mode:ProviderSyncMode;cursor?:string}>;
export type ProviderSyncResult=Readonly<{cursor?:string;processed:number;created:number;updated:number;failed:number;startedAt:string;completedAt:string}>;
export type ProviderHealth=Readonly<{state:ProviderHealthState;checkedAt:string;lastSuccessfulSyncAt?:string;lastFailedSyncAt?:string;synchronizationAgeSeconds?:number;freshness:"current"|"aging"|"stale"|"unknown";message:string}>;
export interface MessagingProviderAdapter{
  readonly id:string;readonly name:string;readonly version:string;readonly channels:readonly string[];readonly capabilities:readonly MessagingProviderCapability[];
  configuration():Readonly<{configured:boolean;authentication:"configured"|"missing"|"external";requiredEnvironment:readonly string[]}>;
  sendMessage(command:ProviderMessageCommand):Promise<ProviderSendResult>;
  receiveMessages(input:Readonly<{workspaceId:string;connectionId:string;cursor?:string}>):Promise<readonly ProviderInboundMessage[]>;
  synchronize(command:ProviderSyncCommand):Promise<ProviderSyncResult>;
  resolveThread(input:Readonly<{providerThreadId?:string;reservationReference?:string;guestReference?:string;propertyReference?:string}>):Promise<Readonly<{providerThreadId?:string;reservationReference?:string}>>;
  health(input:Readonly<{connectionStatus:string;lastSuccessfulSyncAt?:string;lastFailedSyncAt?:string;now?:Date}>):Promise<ProviderHealth>;
  disconnect(input:Readonly<{workspaceId:string;connectionId:string}>):Promise<void>;
}

export function mapProviderDeliveryState(value:string):CanonicalDeliveryState{
  const normalized=value.toLowerCase().replaceAll("_","-");
  if(["queued","pending","accepted"].includes(normalized))return"queued";
  if(["sending","processing"].includes(normalized))return"sending";
  if(["sent","delivered"].includes(normalized))return"delivered";
  if(["read","seen"].includes(normalized))return"read";
  if(["failed","rejected","undeliverable"].includes(normalized))return"failed";
  return"unknown";
}
export function providerFailure(error:unknown):ProviderFailure{
  const status=typeof error==="object"&&error!==null&&"status"in error?Number(error.status):0;
  if(status===401||status===403)return{code:"provider-unauthorized",message:"The messaging provider authorization is no longer valid.",impact:"New replies cannot be transported, but conversation history and drafts remain available.",recovery:"Reconnect the provider.",retryable:false};
  if(status===429)return{code:"provider-rate-limited",message:"The provider temporarily limited message delivery.",impact:"This reply remains queued safely.",recovery:"Retry after the provider limit resets.",retryable:true};
  if(status===408||status===504)return{code:"provider-timeout",message:"The provider did not acknowledge the reply in time.",impact:"Delivery is unconfirmed; the canonical message remains available.",recovery:"Retry safely using the same message identity.",retryable:true};
  if(error instanceof Error&&error.message==="unsupported-capability")return{code:"unsupported-capability",message:"The selected provider cannot perform this communication action.",impact:"The message remains in platform history and was not transported.",recovery:"Choose a connected provider with the required capability.",retryable:false};
  if(error instanceof Error&&error.message==="thread-unresolved")return{code:"thread-unresolved",message:"No provider thread could be resolved for this conversation.",impact:"The message cannot be delivered automatically.",recovery:"Review and associate the provider thread.",retryable:false};
  return{code:"provider-unavailable",message:"The messaging provider is temporarily unavailable.",impact:"The message remains safe in conversation history.",recovery:"Retry after provider service is restored.",retryable:true};
}

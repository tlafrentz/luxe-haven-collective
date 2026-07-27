import { hospitableRequest } from "./client";

type HospitableMessageResponse=Readonly<{data?:Readonly<{id?:string;status?:string}>;id?:string;status?:string}>;

export type HospitableReservationMessage=Readonly<{
  platform?:string;
  platform_id?:string|number;
  conversation_id?:string;
  reservation_id?:string;
  content_type?:string;
  body?:string;
  attachments?:readonly Readonly<{type?:string;url?:string}>[];
  sender_type?:string;
  sender_role?:string;
  sender?:Readonly<{first_name?:string;full_name?:string}>;
  user?:Readonly<{id?:string;email?:string;name?:string}>;
  created_at?:string;
  source?:string;
  integration?:string;
  sent_reference_id?:string;
}>;

type HospitableMessagesResponse=Readonly<{data?:readonly HospitableReservationMessage[]}>;

export type NormalizedHospitableMessage=Readonly<{
  providerMessageId:string;
  body:string;
  occurredAt:string;
  direction:"inbound"|"outbound";
  senderType:"guest"|"operator";
  senderDisplayName:string;
  platform:string;
}>;

export async function getHospitableReservationMessages(reservationId:string){
  const response=await hospitableRequest<HospitableMessagesResponse>(
    `/reservations/${encodeURIComponent(reservationId)}/messages`,
  );
  return Object.freeze([...(response.data??[])]);
}

export function normalizeHospitableMessage(
  message:HospitableReservationMessage,
):NormalizedHospitableMessage|null{
  const body=message.body?.trim()??"";
  const occurredAt=message.created_at??"";
  const providerMessageId=message.sent_reference_id?.trim()
    ||(message.platform&&message.platform_id!==undefined
      ?`${message.platform}:${message.platform_id}`
      :"");
  if(!providerMessageId||!body||body.length>10_000||!isTimestamp(occurredAt))return null;
  const sender=(message.sender_type??message.sender_role??"").toLowerCase();
  const inbound=["guest","traveler","renter"].includes(sender);
  return Object.freeze({
    providerMessageId,
    body,
    occurredAt:new Date(occurredAt).toISOString(),
    direction:inbound?"inbound":"outbound",
    senderType:inbound?"guest":"operator",
    senderDisplayName:message.sender?.full_name?.trim()
      ||message.user?.name?.trim()
      ||(inbound?"Guest":"Hospitable"),
    platform:message.platform?.trim()||message.integration?.trim()||"hospitable",
  });
}

function isTimestamp(value:string){
  return value.length>0&&!Number.isNaN(Date.parse(value));
}

/** Provider adapter boundary for Hospitable's reservation conversation API. */
export async function sendHospitableReservationMessage(input:Readonly<{reservationId:string;body:string}>){
  const response=await hospitableRequest<HospitableMessageResponse>(`/reservations/${encodeURIComponent(input.reservationId)}/messages`,{method:"POST",body:{message:input.body}});
  const data=response.data??response,providerMessageId=data.id;
  if(!providerMessageId)throw new Error("provider_invalid_response");
  return Object.freeze({providerMessageId,status:data.status==="delivered"?"delivered"as const:"sent"as const});
}
